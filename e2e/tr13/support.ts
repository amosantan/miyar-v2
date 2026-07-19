import mysql from "mysql2/promise";
import { initializeDatabaseSafety } from "../../server/_core/database-safety";
import { TR13_MYSQL_CRITICAL_FIXTURE } from "../../tests/fixtures/workflows/tr13-workflow-fixtures";

initializeDatabaseSafety("integration-test", { loadDotenv: false });

const TR13_PRIMARY_ORG_ID = TR13_MYSQL_CRITICAL_FIXTURE.ids.primaryOrg;
const TR13_PRIMARY_ORG_NAME =
  TR13_MYSQL_CRITICAL_FIXTURE.organizations.primary.name;

function requireDisposableDatabaseUrl(): string {
  const value = process.env.DATABASE_URL;
  if (!value) {
    throw new Error("TR-13 browser support requires DATABASE_URL");
  }

  const target = new URL(value);
  const database = decodeURIComponent(target.pathname.slice(1));
  if (
    !["127.0.0.1", "localhost", "::1"].includes(target.hostname) ||
    !database.startsWith("miyar_test_tr13_")
  ) {
    throw new Error(
      "TR-13 browser support requires a loopback disposable database"
    );
  }
  return value;
}

/**
 * The browser app server deliberately has no production fixture switch for AI.
 * The real-MySQL router suite certifies AI-advisor generation with a Vitest-only
 * invokeLLM mock. For the browser's public-share leg, insert only the synthetic
 * narrative prerequisite and recommendations against the project created by the
 * browser; every subsequent read/share/revoke operation uses real HTTP routes.
 */
export async function seedSyntheticAdvisorSharePrerequisite(
  projectId: number,
  projectName: string
): Promise<void> {
  const connection = await mysql.createConnection(
    requireDisposableDatabaseUrl()
  );
  try {
    const [projects] = await connection.query<mysql.RowDataPacket[]>(
      `select p.id, p.orgId, p.name, o.name as orgName
       from projects p
       inner join organizations o on o.id = p.orgId
       where p.id = ? and p.orgId = ? limit 1`,
      [projectId, TR13_PRIMARY_ORG_ID]
    );
    if (
      projects.length !== 1 ||
      projects[0]?.name !== projectName ||
      projects[0]?.orgName !== TR13_PRIMARY_ORG_NAME
    ) {
      throw new Error(
        "TR-13 browser project is missing from the primary synthetic organization"
      );
    }

    await connection.beginTransaction();
    await connection.query(
      "delete from space_recommendations where project_id = ? and org_id = ?",
      [projectId, TR13_PRIMARY_ORG_ID]
    );
    await connection.query(
      `insert into space_recommendations
        (project_id, org_id, room_id, room_name, sqm, style_direction,
         color_scheme, material_package, budget_allocation, budget_breakdown,
         ai_rationale, special_notes, alternatives)
       select projectId, organizationId, roomCode, roomName, sqm,
         'Synthetic browser certification', 'Warm neutral', json_array(),
         round(sqm * 100, 2), json_array(),
         'Synthetic prerequisite; AI generation is certified in the Vitest-only MySQL router suite',
         json_array(), json_array()
       from space_program_rooms
       where projectId = ? and organizationId = ? and isFitOut = true`,
      [projectId, TR13_PRIMARY_ORG_ID]
    );
    await connection.query(
      "delete from ai_design_briefs where project_id = ? and org_id = ?",
      [projectId, TR13_PRIMARY_ORG_ID]
    );
    await connection.query(
      `insert into ai_design_briefs
       (project_id, org_id, brief_data, version)
       values (?, ?, ?, 'tr13-browser-v1')`,
      [
        projectId,
        TR13_PRIMARY_ORG_ID,
        JSON.stringify({
          executiveSummary:
            "Synthetic browser prerequisite for public-share certification.",
          designDirection: {
            overallStyle: "Modern",
            certificationBoundary:
              "AI generation is certified separately with a Vitest-only invokeLLM mock.",
          },
        }),
      ]
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.end();
  }
}

/**
 * Local storage returns a data URL, which exercises the report iframe path.
 * Convert the browser-created synthetic report to the already supported inline
 * shape so SC-04 also proves ReportRenderer's interaction-level lazy boundary.
 */
export async function prepareSyntheticInlineReportPreview(
  projectId: number,
  reportId: number
): Promise<void> {
  const connection = await mysql.createConnection(
    requireDisposableDatabaseUrl()
  );
  try {
    const [reports] = await connection.query<mysql.RowDataPacket[]>(
      `select r.id, r.content, p.orgId
       from report_instances r
       inner join projects p on p.id = r.projectId
       where r.id = ? and r.projectId = ? and p.orgId = ? limit 1`,
      [reportId, projectId, TR13_PRIMARY_ORG_ID]
    );
    if (reports.length !== 1 || reports[0]?.content == null) {
      throw new Error(
        "TR-13 browser report is missing from the primary synthetic organization"
      );
    }
    const [result] = await connection.query<mysql.ResultSetHeader>(
      `update report_instances r
       inner join projects p on p.id = r.projectId
       set r.fileUrl = null, r.storageKey = null
       where r.id = ? and r.projectId = ? and p.orgId = ?`,
      [reportId, projectId, TR13_PRIMARY_ORG_ID]
    );
    if (result.affectedRows !== 1) {
      throw new Error("TR-13 synthetic inline report preparation failed");
    }
  } finally {
    await connection.end();
  }
}
