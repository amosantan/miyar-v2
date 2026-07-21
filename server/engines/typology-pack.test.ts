import { describe, expect, it } from "vitest";
import {
  NEUTRAL_SYNTHETIC_TYPOLOGY_PACK,
  validateTypologyPack,
} from "@shared/typology-pack";
import {
  canonicalizeTypologyPack,
  fingerprintTypologyPack,
  resolveTypologyPack,
  TypologyPackResolutionError,
  BUILT_IN_TYPOLOGY_PACK_FINGERPRINT_MANIFEST,
  typologyPackOverridePayloadSchema,
} from "./typology-pack";

const base = NEUTRAL_SYNTHETIC_TYPOLOGY_PACK;
const ref = { packId: base.packId, version: base.version, fingerprint: fingerprintTypologyPack(base) };

describe("BR-05 typology-pack deterministic contract", () => {
  it("rejects unknown keys, unsafe numeric values, and cyclic adjacency", () => {
    expect(() => validateTypologyPack({ ...base, unknown: true })).toThrow();
    const unsafe = structuredClone(base);
    unsafe.roomArchetypes[0].area.min.value = Number.NaN;
    expect(() => validateTypologyPack(unsafe)).toThrow();
    const cyclic = structuredClone(base);
    cyclic.roomArchetypes.push({ ...cyclic.roomArchetypes[0], id: "other-room", name: "Other room" });
    cyclic.constraints = [
      { id: "a-to-b", kind: "adjacency", fromRoomArchetypeId: "example-room", toRoomArchetypeId: "other-room", relationship: "must_adjoin" },
      { id: "b-to-a", kind: "adjacency", fromRoomArchetypeId: "other-room", toRoomArchetypeId: "example-room", relationship: "must_adjoin" },
    ];
    expect(() => validateTypologyPack(cyclic)).toThrow(/cycle/);
  });

  it("canonicalizes object ordering and fingerprints meaningful changes", () => {
    expect(canonicalizeTypologyPack({ b: [2, { z: true, a: 1 }], a: "x" })).toBe(canonicalizeTypologyPack({ a: "x", b: [2, { a: 1, z: true }] }));
    expect(fingerprintTypologyPack(base)).not.toBe(fingerprintTypologyPack({ ...base, title: "Changed" }));
  });

  it("requires an exact version and immutable fingerprint, never a latest match", () => {
    expect(() => resolveTypologyPack({ reference: { ...ref, fingerprint: "0".repeat(64) }, builtIns: [base] })).toThrow(TypologyPackResolutionError);
    expect(() => resolveTypologyPack({ reference: { ...ref, version: "99.0.0" }, builtIns: [base] })).toThrow(TypologyPackResolutionError);
    expect(resolveTypologyPack({ reference: ref, builtIns: [base] })).toEqual(base);
  });

  it("pins shipped built-ins to the checked-in fingerprint manifest", () => {
    expect(BUILT_IN_TYPOLOGY_PACK_FINGERPRINT_MANIFEST["neutral-example@0.1.0"]).toBe(ref.fingerprint);
    const changedWithoutVersionBump = { ...base, title: "Changed" };
    const changedReference = { ...ref, fingerprint: fingerprintTypologyPack(changedWithoutVersionBump) };
    expect(() => resolveTypologyPack({ reference: changedReference, builtIns: [changedWithoutVersionBump] })).toThrow(/immutable fingerprint manifest/);
    const unshipped = { ...base, packId: "unshipped-pack" };
    expect(() => resolveTypologyPack({ reference: { packId: unshipped.packId, version: unshipped.version, fingerprint: fingerprintTypologyPack(unshipped) }, builtIns: [unshipped] })).toThrow(/immutable fingerprint manifest/);
  });

  it("rejects semantically contradictory adjacency, fit-out, and area rules", () => {
    const secondRoom = { ...base.roomArchetypes[0], id: "other-room", name: "Other room" };
    const contradictoryAdjacency = {
      ...base, roomArchetypes: [base.roomArchetypes[0], secondRoom], constraints: [
        { id: "adjoin", kind: "adjacency" as const, fromRoomArchetypeId: "example-room", toRoomArchetypeId: "other-room", relationship: "must_adjoin" as const },
        { id: "separate", kind: "adjacency" as const, fromRoomArchetypeId: "other-room", toRoomArchetypeId: "example-room", relationship: "must_separate" as const },
      ],
    };
    expect(() => validateTypologyPack(contradictoryAdjacency)).toThrow(/both adjoin and separate/);

    const contradictoryFitout = {
      ...base, constraints: [
        { id: "shell", kind: "fitout_scope" as const, roomArchetypeId: "example-room", scope: "shell_and_core" as const },
        { id: "full", kind: "fitout_scope" as const, roomArchetypeId: "example-room", scope: "full_fitout" as const },
      ],
    };
    expect(() => validateTypologyPack(contradictoryFitout)).toThrow(/conflicting fit-out scopes/);

    const contradictoryAreas = {
      ...base, constraints: [
        { id: "small", kind: "area_range" as const, roomArchetypeId: "example-room", range: { min: { value: 1, unit: "sqm" as const, basis: "room_net" as const, precision: 0, rounding: "none" as const }, max: { value: 2, unit: "sqm" as const, basis: "room_net" as const, precision: 0, rounding: "none" as const } } },
        { id: "large", kind: "area_range" as const, roomArchetypeId: "example-room", range: { min: { value: 3, unit: "sqm" as const, basis: "room_net" as const, precision: 0, rounding: "none" as const }, max: { value: 4, unit: "sqm" as const, basis: "room_net" as const, precision: 0, rounding: "none" as const } } },
      ],
    };
    expect(() => validateTypologyPack(contradictoryAreas)).toThrow(/must overlap/);

    const conflictsWithArchetype = {
      ...base,
      constraints: [
        { id: "outside-archetype", kind: "area_range" as const, roomArchetypeId: "example-room", range: { min: { value: 3, unit: "sqm" as const, basis: "room_net" as const, precision: 0, rounding: "none" as const }, max: { value: 4, unit: "sqm" as const, basis: "room_net" as const, precision: 0, rounding: "none" as const } } },
      ],
    };
    expect(() => validateTypologyPack(conflictsWithArchetype)).toThrow(/room archetype area/);

    const conflictsWithArchetypeBasis = structuredClone(conflictsWithArchetype);
    conflictsWithArchetypeBasis.constraints[0].range.min.basis = "gfa";
    conflictsWithArchetypeBasis.constraints[0].range.max.basis = "gfa";
    expect(() => validateTypologyPack(conflictsWithArchetypeBasis)).toThrow(/unit and basis/);

    const optionalRequiredRoom = structuredClone(base);
    optionalRequiredRoom.roomArchetypes[0].required = false;
    expect(() => validateTypologyPack(optionalRequiredRoom)).toThrow(/required-room constraint/);
  });

  it("allows a same-organization approved override to narrow but not relax a range", () => {
    const override = {
      organizationId: "org-1", status: "approved" as const, approvedAt: "2026-01-02T00:00:00.000Z", pack: ref,
      operations: [{ kind: "add_constraint" as const, constraint: { id: "fitout", kind: "fitout_scope" as const, roomArchetypeId: "example-room", scope: "full_fitout" as const } }],
    };
    expect(resolveTypologyPack({ reference: ref, builtIns: [base], organizationId: "org-1", override }).constraints).toHaveLength(2);
    expect(() => resolveTypologyPack({ reference: ref, builtIns: [base], organizationId: "org-2", override })).toThrow(/same-organization/);
  });

  it("rejects override payloads that contain executable or unrecognized operations", () => {
    expect(typologyPackOverridePayloadSchema.safeParse({ pack: ref, operations: [{ kind: "expression", expression: "return true" }] }).success).toBe(false);
  });
});
