var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/_core/llm.ts
async function invokeLLM(params) {
  assertApiKey();
  const {
    messages,
    tools,
    outputSchema,
    output_schema,
    responseFormat,
    response_format
  } = params;
  const { systemInstruction, contents } = await convertMessagesToGemini(messages);
  const payload = {
    contents
  };
  if (systemInstruction) {
    payload.systemInstruction = systemInstruction;
  }
  if (tools && tools.length > 0) {
    const geminiTools = [
      {
        functionDeclarations: tools.map((t2) => ({
          name: t2.function.name,
          description: t2.function.description,
          parameters: t2.function.parameters
        }))
      }
    ];
    payload.tools = geminiTools;
  }
  const schema = outputSchema || output_schema;
  const explicitFormat = responseFormat || response_format;
  if (schema) {
    payload.generationConfig = {
      responseMimeType: "application/json",
      responseSchema: schema.schema
    };
  } else if (explicitFormat?.type === "json_object") {
    payload.generationConfig = {
      responseMimeType: "application/json"
    };
  }
  let response;
  let attempt = 0;
  const maxRetries = 2;
  while (attempt <= maxRetries) {
    response = await fetch(resolveApiUrl(), {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    if (response.ok) {
      break;
    }
    if (response.status === 429 || response.status === 503) {
      attempt++;
      if (attempt > maxRetries) break;
      const errorText = await response.text();
      console.warn(`[Gemini API] HTTP ${response.status} hit. Retrying attempt ${attempt}/${maxRetries}... Error details: ${errorText.substring(0, 200)}`);
      const delay = Math.pow(2, attempt) * 1e3 + Math.random() * 500;
      await new Promise((resolve) => setTimeout(resolve, delay));
    } else {
      break;
    }
  }
  if (!response || !response.ok) {
    const errorText = response ? await response.text().catch(() => "Unknown error") : "No response";
    const isRateLimit = response?.status === 429;
    throw new Error(
      isRateLimit ? `Gemini Request Limit Reached: Your API key is on the Free Tier (15 requests/min). Please update GEMINI_API_KEY in .env with a billing-enabled key from Google AI Studio.` : `Gemini LLM invoke failed: ${response?.status} ${response?.statusText} \u2013 ${errorText}`
    );
  }
  const data = await response.json();
  const candidate = data.candidates?.[0];
  if (!candidate) {
    throw new Error("No candidates returned from Gemini API");
  }
  const parts = candidate.content?.parts || [];
  const textParts = parts.filter((p) => p.text).map((p) => p.text).join("");
  const functionCallParts = parts.filter((p) => p.functionCall);
  let tool_calls;
  if (functionCallParts.length > 0) {
    tool_calls = functionCallParts.map((fc, idx) => ({
      id: `call_${Date.now()}_${idx}`,
      type: "function",
      function: {
        name: fc.functionCall.name,
        arguments: JSON.stringify(fc.functionCall.args || {})
      }
    }));
  }
  return {
    id: `gemini-${Date.now()}`,
    created: Math.floor(Date.now() / 1e3),
    model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: textParts,
          tool_calls
        },
        finish_reason: candidate.finishReason === "STOP" ? "stop" : functionCallParts.length > 0 ? "tool_calls" : "length"
      }
    ],
    usage: {
      prompt_tokens: data.usageMetadata?.promptTokenCount || 0,
      completion_tokens: data.usageMetadata?.candidatesTokenCount || 0,
      total_tokens: data.usageMetadata?.totalTokenCount || 0
    }
  };
}
var ensureArray, normalizeContentPart, mapRoleToGemini, normalizeContentToGeminiParts, convertMessagesToGemini, resolveApiUrl, assertApiKey;
var init_llm = __esm({
  "server/_core/llm.ts"() {
    "use strict";
    ensureArray = (value) => Array.isArray(value) ? value : [value];
    normalizeContentPart = (part) => {
      if (typeof part === "string") {
        return { type: "text", text: part };
      }
      if (part.type === "text") {
        return part;
      }
      if (part.type === "image_url") {
        return part;
      }
      if (part.type === "file_url") {
        return part;
      }
      throw new Error("Unsupported message content part");
    };
    mapRoleToGemini = (role) => {
      if (role === "assistant") return "model";
      return "user";
    };
    normalizeContentToGeminiParts = async (content) => {
      const parts = ensureArray(content).map(normalizeContentPart);
      return await Promise.all(parts.map(async (part) => {
        if (part.type === "text") return { text: part.text };
        if (part.type === "image_url") {
          try {
            const response = await fetch(part.image_url.url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const mimeType = response.headers.get("content-type") || "image/jpeg";
            return {
              inlineData: {
                mimeType,
                data: buffer.toString("base64")
              }
            };
          } catch (err) {
            console.error("Failed to fetch image for Gemini inlineData:", err.message);
            return { text: `[Image reference: ${part.image_url.url}]` };
          }
        }
        if (part.type === "file_url") {
          return { text: `[File reference: ${part.file_url.url}]` };
        }
        return { text: "" };
      }));
    };
    convertMessagesToGemini = async (messages) => {
      let systemInstruction;
      const contents = [];
      for (const msg of messages) {
        if (msg.role === "system") {
          const parts2 = await normalizeContentToGeminiParts(msg.content);
          if (!systemInstruction) systemInstruction = { parts: [] };
          systemInstruction.parts.push(...parts2);
          continue;
        }
        if (msg.role === "tool" || msg.role === "function") {
          const responseText = ensureArray(msg.content).map((p) => typeof p === "string" ? p : JSON.stringify(p)).join("\n");
          let parsedResponse;
          try {
            parsedResponse = JSON.parse(responseText);
          } catch {
            parsedResponse = { result: responseText };
          }
          contents.push({
            role: "user",
            parts: [{
              functionResponse: {
                name: msg.name || "unknown_tool",
                response: parsedResponse
              }
            }]
          });
          continue;
        }
        const role = mapRoleToGemini(msg.role);
        const parts = await normalizeContentToGeminiParts(msg.content);
        if (msg.role === "assistant" && msg.tool_calls?.length > 0) {
          const functionCalls = msg.tool_calls.map((tc) => ({
            functionCall: {
              name: tc.function.name,
              args: JSON.parse(tc.function.arguments || "{}")
            }
          }));
          contents.push({
            role: "model",
            parts: [...parts, ...functionCalls]
          });
          continue;
        }
        contents.push({ role, parts });
      }
      return { systemInstruction, contents };
    };
    resolveApiUrl = () => {
      const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
      return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;
    };
    assertApiKey = () => {
      if (!process.env.GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY is not configured in the environment");
      }
    };
  }
});

// server/engines/design/vocabulary.ts
var vocabulary_exports = {};
__export(vocabulary_exports, {
  buildDesignVocabulary: () => buildDesignVocabulary
});
function buildDesignVocabulary(project) {
  const cap = Number(project.fin01BudgetCap || 0);
  const styleRaw = (project.des01Style || "modern").toLowerCase();
  let style = styleRaw;
  if (!["modern", "minimalist", "arabesque", "classic", "contemporary"].includes(style)) {
    style = "modern";
  }
  const des03_n = Number(project.des03Complexity || 0);
  const des04_n = Number(project.des04Experience || 0);
  const des05_n = Number(project.des05Sustainability || 0);
  const mkt01Tier = (project.mkt01Tier || "mid").toLowerCase();
  let materialTier = "mid";
  if (cap < 200) materialTier = "affordable";
  else if (cap < 300) materialTier = "mid";
  else if (cap < 450) materialTier = "premium";
  else materialTier = "ultra";
  const finishTone = des04_n >= 0.5 ? "warm" : "cool";
  let paletteKey = "warm_minimalism";
  if (["modern", "minimalist"].includes(style)) {
    if (finishTone === "warm") {
      paletteKey = "warm_minimalism";
    } else {
      paletteKey = "cool_minimalism";
    }
  } else if (["arabesque", "classic"].includes(style)) {
    if (style === "classic" && ["premium", "ultra"].includes(materialTier)) {
      paletteKey = "classic_marble";
    } else {
      paletteKey = "arabesque_warmth";
    }
  } else {
    paletteKey = "warm_minimalism";
  }
  let hardwareFinish = "Brushed Chrome";
  if (["modern", "minimalist"].includes(style)) hardwareFinish = "Brushed Chrome";
  else if (style === "arabesque") hardwareFinish = "Polished Brass";
  else if (style === "classic") hardwareFinish = "Polished Chrome";
  else if (style === "contemporary") hardwareFinish = "Matte Black";
  let ceilingType = "Standard Gypsum";
  if (des03_n > 0.7) {
    ceilingType = "Feature Coffered Ceiling";
  } else if (des03_n >= 0.4) {
    ceilingType = "Gypsum with Cove Lighting Detail";
  }
  let lightingMood = "Warm White 2700K";
  if (["ultra", "premium"].includes(mkt01Tier)) {
  }
  if (["ultra", "premium"].includes(mkt01Tier)) {
    lightingMood = "Layered Lighting 2700\u20134000K";
  } else if (style === "arabesque") {
    lightingMood = "Warm Accent 2700K";
  } else {
    lightingMood = "Warm White 2700K";
  }
  const styleFamily = `${mkt01Tier.charAt(0).toUpperCase() + mkt01Tier.slice(1)} ${style.charAt(0).toUpperCase() + style.slice(1)}`;
  let complexityLabel = "Standard";
  if (des03_n < 0.3) complexityLabel = "Simplified";
  else if (des03_n > 0.7) complexityLabel = "Bespoke";
  else complexityLabel = "Rich";
  let joinery = "Standard MDF / Laminate";
  if (materialTier === "ultra" || materialTier === "premium") joinery = "Custom Wood Veneer & PU Paint";
  let floorPrimary = "Porcelain Tile / SPC Vinyl";
  if (materialTier === "ultra") floorPrimary = "Natural Stone / Marble";
  else if (materialTier === "premium") floorPrimary = "Engineered Hardwood";
  let floorWet = "Anti-slip Ceramic";
  if (materialTier === "ultra" || materialTier === "premium") floorWet = "Textured Porcelain / Marble";
  let sustainNote = "Standard building compliance.";
  if (des05_n > 0.6) {
    sustainNote = "Focus on sustainable materials, LEED/Al Sa'fat alignment.";
  }
  return {
    styleFamily,
    materialTier,
    paletteKey,
    complexityLabel,
    finishTone: finishTone === "warm" ? "Warm Neutrals" : "Cool Greys",
    joinery,
    hardwareFinish,
    floorPrimary,
    floorWet,
    ceilingType,
    lightingMood,
    sustainNote
  };
}
var init_vocabulary = __esm({
  "server/engines/design/vocabulary.ts"() {
    "use strict";
  }
});

// server/engines/design/space-program.ts
var space_program_exports = {};
__export(space_program_exports, {
  buildSpaceProgram: () => buildSpaceProgram
});
function buildSpaceProgram(project) {
  const gfa = Number(project.ctx03Gfa || 0);
  const budgetCap = Number(project.fin01BudgetCap || 0);
  const typology = (project.ctx01Typology || "Residential").toLowerCase();
  const totalFitoutBudgetAed = gfa * budgetCap * 10.764 * 0.35;
  let baseRooms = [];
  if (typology === "hospitality") {
    baseRooms = [
      { id: "LBY", name: "Hotel Lobby", pctSqm: 0.2, pctBudget: 0.3, priority: "high", finishGrade: "A" },
      { id: "GRM", name: "Guest Room (std)", pctSqm: 0.25, pctBudget: 0.2, priority: "high", finishGrade: "A" },
      { id: "GRS", name: "Guest Room (suite)", pctSqm: 0.1, pctBudget: 0.2, priority: "high", finishGrade: "A" },
      { id: "FBB", name: "F&B / Restaurant", pctSqm: 0.2, pctBudget: 0.15, priority: "high", finishGrade: "A" },
      { id: "COR", name: "Corridors", pctSqm: 0.15, pctBudget: 0.05, priority: "medium", finishGrade: "B" },
      { id: "BOH", name: "Back of House", pctSqm: 0.1, pctBudget: 0.1, priority: "low", finishGrade: "C" }
    ];
  } else if (typology === "commercial" || typology === "office") {
    baseRooms = [
      { id: "OPN", name: "Open Plan Office", pctSqm: 0.4, pctBudget: 0.25, priority: "medium", finishGrade: "B" },
      { id: "MET", name: "Meeting Rooms", pctSqm: 0.2, pctBudget: 0.3, priority: "high", finishGrade: "A" },
      { id: "RCP", name: "Reception", pctSqm: 0.1, pctBudget: 0.2, priority: "high", finishGrade: "A" },
      { id: "BRK", name: "Break Areas", pctSqm: 0.1, pctBudget: 0.1, priority: "medium", finishGrade: "B" },
      { id: "COR", name: "Circulation", pctSqm: 0.1, pctBudget: 0.05, priority: "low", finishGrade: "C" },
      { id: "UTL", name: "Utility & WCs", pctSqm: 0.1, pctBudget: 0.1, priority: "medium", finishGrade: "B" }
    ];
  } else {
    baseRooms = [
      { id: "LVG", name: "Living & Dining", pctSqm: 0.28, pctBudget: 0.28, priority: "high", finishGrade: "A" },
      { id: "MBR", name: "Master Bedroom", pctSqm: 0.18, pctBudget: 0.22, priority: "high", finishGrade: "A" },
      { id: "MEN", name: "Master Ensuite", pctSqm: 0.08, pctBudget: 0.14, priority: "high", finishGrade: "A" },
      { id: "KIT", name: "Kitchen", pctSqm: 0.1, pctBudget: 0.16, priority: "high", finishGrade: "A" },
      { id: "BD2", name: "Bedroom 2", pctSqm: 0.1, pctBudget: 0.07, priority: "medium", finishGrade: "B" },
      { id: "BD3", name: "Bedroom 3", pctSqm: 0.08, pctBudget: 0.05, priority: "medium", finishGrade: "B" },
      { id: "BTH", name: "Bathroom 2", pctSqm: 0.05, pctBudget: 0.05, priority: "medium", finishGrade: "B" },
      { id: "ENT", name: "Entry & Corridors", pctSqm: 0.08, pctBudget: 0.02, priority: "low", finishGrade: "B" },
      { id: "UTL", name: "Utility & Maid's", pctSqm: 0.05, pctBudget: 0.01, priority: "low", finishGrade: "C" }
    ];
  }
  const rooms = baseRooms.map((r) => ({
    id: r.id,
    name: r.name,
    sqm: Number((gfa * r.pctSqm).toFixed(2)),
    budgetPct: r.pctBudget,
    priority: r.priority,
    finishGrade: r.finishGrade
  }));
  const totalAllocatedSqm = rooms.reduce((sum, r) => sum + r.sqm, 0);
  return {
    totalFitoutBudgetAed,
    rooms,
    totalAllocatedSqm
  };
}
var init_space_program = __esm({
  "server/engines/design/space-program.ts"() {
    "use strict";
  }
});

// server/engines/design/finish-schedule.ts
var finish_schedule_exports = {};
__export(finish_schedule_exports, {
  buildFinishSchedule: () => buildFinishSchedule
});
function buildFinishSchedule(project, vocab, rooms, materials) {
  const schedule = [];
  const downgradeTier = (tier) => {
    if (tier === "ultra") return "premium";
    if (tier === "premium") return "mid";
    if (tier === "mid") return "affordable";
    return "affordable";
  };
  const getMaterial = (element, roomTier, elementStyle) => {
    let category = element;
    if (element === "floor") category = "flooring";
    else if (element.startsWith("wall_")) {
      if (element === "wall_wet") category = "wall_tile";
      else category = "wall_paint";
    }
    let match = materials.find(
      (m) => m.category === category && m.tier === roomTier && (m.style === elementStyle || m.style === "all")
    );
    if (!match) match = materials.find((m) => m.category === category && m.tier === roomTier);
    if (!match) match = materials.find((m) => m.category === category && (m.style === elementStyle || m.style === "all"));
    if (!match) match = materials.find((m) => m.category === category);
    return match;
  };
  for (const room of rooms) {
    const elements = ["floor", "wall_primary", "wall_feature", "wall_wet", "ceiling", "joinery", "hardware"];
    for (const element of elements) {
      if (element === "wall_wet" && ["LVG", "MBR", "BD2", "BD3", "ENT", "OPN", "MET", "RCP", "BRK", "COR"].includes(room.id)) {
        continue;
      }
      if (element === "wall_feature" && ["UTL", "BOH", "COR", "ENT", "BTH", "MEN"].includes(room.id)) {
        continue;
      }
      let activeTier = vocab.materialTier;
      if (room.finishGrade === "C") {
        activeTier = "affordable";
      } else if (room.finishGrade === "B") {
        if (element === "floor" || element === "wall_primary") {
          activeTier = downgradeTier(activeTier);
        }
      }
      let activeStyle = "modern";
      if (vocab.paletteKey.includes("minimalism")) activeStyle = "minimalist";
      else if (vocab.paletteKey.includes("arabesque")) activeStyle = "arabesque";
      else if (vocab.paletteKey.includes("classic")) activeStyle = "classic";
      const material = getMaterial(element, activeTier, activeStyle);
      let overrideSpec = null;
      if (element === "ceiling") overrideSpec = vocab.ceilingType;
      if (element === "joinery") overrideSpec = vocab.joinery;
      if (element === "hardware") overrideSpec = vocab.hardwareFinish;
      schedule.push({
        projectId: project.id,
        organizationId: project.organizationId,
        roomId: room.id,
        roomName: room.name,
        element,
        materialLibraryId: material ? material.id : null,
        overrideSpec,
        notes: material ? material.notes : null
      });
    }
  }
  return schedule;
}
var init_finish_schedule = __esm({
  "server/engines/design/finish-schedule.ts"() {
    "use strict";
  }
});

// server/engines/design/palette-seeds.ts
var paletteSeeds;
var init_palette_seeds = __esm({
  "server/engines/design/palette-seeds.ts"() {
    "use strict";
    paletteSeeds = {
      warm_minimalism: {
        name: "Warm Minimalism",
        style: ["modern", "contemporary", "mid", "premium", "ultra"],
        colors: [
          { role: "Primary", name: "Natural Linen", brand: "Jotun Fenomastic 10BB 83/008", code: "#EAE6D7", ral: "RAL 1013", finish: "Matte", applyTo: "General Walls" },
          { role: "Secondary", name: "Warm Canvas", brand: "Jotun Lady 11YY 86/030", code: "#F2EDDB", ral: "RAL 9001", finish: "Eggshell", applyTo: "Passageways" },
          { role: "Accent", name: "Desert Bronze", brand: "National Paints 7002", code: "#8F7B66", ral: "RAL 8024", finish: "Satin", applyTo: "Niches & Details" },
          { role: "Feature Wall", name: "Earth Spice", brand: "Jotun Lady 40YY 40/149", code: "#B59E75", ral: "RAL 1011", finish: "Matte", applyTo: "Living / Master Bed" },
          { role: "Trim/Joinery", name: "Pure Brilliant White", brand: "Dulux", code: "#F4F8F4", ral: "RAL 9010", finish: "Semi-gloss", applyTo: "Doors & Skirting" }
        ]
      },
      cool_minimalism: {
        name: "Cool Minimalism",
        style: ["minimalist", "modern", "mid", "premium", "ultra"],
        colors: [
          { role: "Primary", name: "Pale Slate", brand: "Jotun Fenomastic 53BG 83/006", code: "#D8DCE0", ral: "RAL 7047", finish: "Matte", applyTo: "General Walls" },
          { role: "Secondary", name: "Ivory", brand: "Dulux Natural Hints", code: "#F2EDDB", ral: "RAL 9001", finish: "Eggshell", applyTo: "Passageways" },
          { role: "Accent", name: "Forest Sage", brand: "Jotun Lady 10GG 22/094", code: "#8BA58F", ral: "RAL 6021", finish: "Matte", applyTo: "Study / Bathrooms" },
          { role: "Feature Wall", name: "Carbon Dusk", brand: "National Paints 5004", code: "#383E42", ral: "RAL 7016", finish: "Matte", applyTo: "Media Wall" },
          { role: "Trim/Joinery", name: "Pure White", brand: "Jotun Lady", code: "#F4F8F4", ral: "RAL 9010", finish: "Semi-gloss", applyTo: "Doors & Skirting" }
        ]
      },
      arabesque_warmth: {
        name: "Arabesque Warmth",
        style: ["arabesque", "classic"],
        colors: [
          { role: "Primary", name: "Saffron Cream", brand: "National Paints 1003", code: "#DFBA8D", ral: "RAL 1001", finish: "Matte", applyTo: "General Walls" },
          { role: "Secondary", name: "Terracotta Blush", brand: "Jotun Lady 5YR 73/040", code: "#CC8870", ral: "RAL 3012", finish: "Eggshell", applyTo: "Dining / Corridors" },
          { role: "Accent", name: "Emerald Leaf", brand: "Jotun Lady 6GY 25/076", code: "#00875A", ral: "RAL 6029", finish: "Satin", applyTo: "Entry Foyer" },
          { role: "Feature Wall", name: "Midnight Teal", brand: "Dulux Heritage", code: "#2B5A5C", ral: "RAL 5020", finish: "Matte", applyTo: "Formal Living" },
          { role: "Trim/Joinery", name: "Gold Ochre", brand: "Jotun Lady", code: "#C89F38", ral: "RAL 1005", finish: "Gloss", applyTo: "Custom Joinery" }
        ]
      },
      classic_marble: {
        name: "Classic Marble",
        style: ["classic", "premium", "ultra"],
        colors: [
          { role: "Primary", name: "Wimborne White 239", brand: "Farrow & Ball", code: "#F4F8F4", ral: "RAL 9010", finish: "Estate Emulsion", applyTo: "General Walls" },
          { role: "Secondary", name: "Elephant's Breath 229", brand: "Farrow & Ball", code: "#C5BDB4", ral: "RAL 7044", finish: "Estate Emulsion", applyTo: "Secondary Rooms" },
          { role: "Accent", name: "Olive Gold", brand: "Jotun Lady 70YY 20/199", code: "#9E976A", ral: "RAL 1020", finish: "Satin", applyTo: "Study / Library" },
          { role: "Feature Wall", name: "Railings 31", brand: "Farrow & Ball", code: "#2E3234", ral: "RAL 7021", finish: "Estate Emulsion", applyTo: "Formal Reception" },
          { role: "Trim/Joinery", name: "All White 2005", brand: "Farrow & Ball", code: "#FFFFFF", ral: "RAL 9010", finish: "Gloss", applyTo: "Wainscotting & Trim" }
        ]
      }
    };
  }
});

// server/engines/design/color-palette.ts
var color_palette_exports = {};
__export(color_palette_exports, {
  buildColorPalette: () => buildColorPalette
});
async function buildColorPalette(project, vocab) {
  const palette = paletteSeeds[vocab.paletteKey] || paletteSeeds["warm_minimalism"];
  const prompt = `Why these colors (${palette.colors.map((c) => c.name).join(", ")}) work for ${project.name} in ${project.ctx04Location || "Dubai"} given the ${vocab.styleFamily} direction and ${vocab.materialTier} market position. Please write a 3-sentence stylistic rationale narrative. Do not use asterisks or markdown in your response.`;
  let rationale = "A curated selection of tones tailored for optimal aesthetic and functional resonance.";
  try {
    const result = await invokeLLM({
      messages: [{ role: "user", content: prompt }]
    });
    if (result && result.choices && result.choices.length > 0) {
      rationale = result.choices[0].message.content;
    }
  } catch (err) {
    console.error("Failed to generate palette rationale:", err);
  }
  return {
    projectId: project.id,
    organizationId: project.organizationId,
    paletteKey: vocab.paletteKey,
    colors: palette.colors,
    geminiRationale: rationale
  };
}
var init_color_palette = __esm({
  "server/engines/design/color-palette.ts"() {
    "use strict";
    init_palette_seeds();
    init_llm();
  }
});

// server/engines/design/rfq-generator.ts
var rfq_generator_exports = {};
__export(rfq_generator_exports, {
  buildRFQPack: () => buildRFQPack
});
function buildRFQPack(projectId, orgId, finishSchedule, rooms, materials) {
  const rfqItems = [];
  const getMaterial = (id) => materials.find((m) => m.id === id);
  let subtotalMin = 0;
  let subtotalMax = 0;
  const pushLine = (sectionNo, itemCode, description, unit, quantity, rateMin, rateMax, supplierName) => {
    const totalMin = quantity * rateMin;
    const totalMax = quantity * rateMax;
    subtotalMin += totalMin;
    subtotalMax += totalMax;
    rfqItems.push({
      projectId,
      organizationId: orgId,
      sectionNo,
      itemCode,
      description,
      unit,
      quantity,
      unitRateAedMin: rateMin,
      unitRateAedMax: rateMax,
      totalAedMin: totalMin,
      totalAedMax: totalMax,
      supplierName
    });
  };
  const getSchedulesForRoom = (roomId) => finishSchedule.filter((f) => f.roomId === roomId);
  rooms.forEach((room, idx) => {
    const floors = getSchedulesForRoom(room.id).filter((f) => f.element === "floor");
    floors.forEach((floor) => {
      const mat = getMaterial(floor.materialLibraryId);
      if (mat) {
        pushLine(
          1,
          `FL-${room.id}`,
          `Supply & install ${mat.productName} to ${room.name}`,
          "sqm",
          room.sqm,
          Number(mat.priceAedMin || 0),
          Number(mat.priceAedMax || 0),
          mat.supplierName
        );
      }
    });
  });
  rooms.forEach((room, idx) => {
    const walls = getSchedulesForRoom(room.id).filter((f) => f.element.startsWith("wall_"));
    walls.forEach((wall) => {
      const mat = getMaterial(wall.materialLibraryId);
      if (mat) {
        const areaMultiplier = wall.element === "wall_primary" ? 2.5 : 1;
        const qty = room.sqm * areaMultiplier;
        pushLine(
          2,
          `WL-${room.id}-${wall.element.split("_")[1]}`,
          `Supply & apply ${mat.productName} to ${room.name} (${wall.element})`,
          "sqm",
          qty,
          Number(mat.priceAedMin || 0),
          Number(mat.priceAedMax || 0),
          mat.supplierName
        );
      }
    });
  });
  rooms.forEach((room, idx) => {
    const ceil = getSchedulesForRoom(room.id).find((f) => f.element === "ceiling");
    if (ceil) {
      let rateMin = 90;
      let rateMax = 120;
      if (ceil.overrideSpec?.includes("Coffered")) {
        rateMin = 180;
        rateMax = 250;
      }
      if (ceil.overrideSpec?.includes("Cove")) {
        rateMin = 130;
        rateMax = 160;
      }
      pushLine(
        3,
        `CL-${room.id}`,
        `Supply & install ${ceil.overrideSpec || "Gypsum Ceiling"} to ${room.name}`,
        "sqm",
        room.sqm,
        rateMin,
        rateMax,
        "Various Subcontractors"
      );
    }
  });
  rooms.forEach((room, idx) => {
    const joinery = getSchedulesForRoom(room.id).find((f) => f.element === "joinery");
    if (joinery && ["MBR", "BD2", "BD3", "KIT", "LVG"].includes(room.id)) {
      let lm = room.sqm * 0.2;
      let rateMin = 1200;
      let rateMax = 1800;
      if (room.id === "KIT") {
        rateMin = 2e3;
        rateMax = 3500;
        lm = room.sqm * 0.4;
      }
      pushLine(
        4,
        `JN-${room.id}`,
        `Custom Joinery / Wardrobes / Cabinets in ${room.name} (${joinery.overrideSpec})`,
        "lm",
        lm,
        rateMin,
        rateMax,
        "Specialist Joinery"
      );
    }
  });
  const wetRooms = rooms.filter((r) => ["MEN", "BTH", "UTL", "KIT"].includes(r.id));
  wetRooms.forEach((room) => {
    const swMat = materials.find((m) => m.category === "sanitaryware");
    if (swMat) {
      pushLine(
        5,
        `SW-${room.id}`,
        `Allow for Sanitaryware & Brassware package for ${room.name}`,
        "set",
        1,
        Number(swMat.priceAedMin || 0) * 3,
        // rough multiplier for a full room set
        Number(swMat.priceAedMax || 0) * 4,
        swMat.supplierName
      );
    }
  });
  rfqItems.push({
    projectId,
    organizationId: orgId,
    sectionNo: 6,
    itemCode: "PS-01",
    description: "Contingency (10% of Sections 1-5)",
    unit: "sum",
    quantity: 1,
    unitRateAedMin: subtotalMin * 0.1,
    unitRateAedMax: subtotalMax * 0.1,
    totalAedMin: subtotalMin * 0.1,
    totalAedMax: subtotalMax * 0.1,
    supplierName: ""
  });
  rfqItems.push({
    projectId,
    organizationId: orgId,
    sectionNo: 6,
    itemCode: "PS-02",
    description: "DM/DDA Approval Fees (Provisional)",
    unit: "sum",
    quantity: 1,
    unitRateAedMin: 15e3,
    unitRateAedMax: 15e3,
    totalAedMin: 15e3,
    totalAedMax: 15e3,
    supplierName: "Dubai Authorities"
  });
  rfqItems.push({
    projectId,
    organizationId: orgId,
    sectionNo: 6,
    itemCode: "PS-03",
    description: "FF&E Procurement Management (Provisional)",
    unit: "sum",
    quantity: 1,
    unitRateAedMin: 25e3,
    unitRateAedMax: 25e3,
    totalAedMin: 25e3,
    totalAedMax: 25e3,
    supplierName: "Design Consultant"
  });
  return rfqItems;
}
var init_rfq_generator = __esm({
  "server/engines/design/rfq-generator.ts"() {
    "use strict";
  }
});

// server/engines/design/dm-compliance.ts
var dm_compliance_exports = {};
__export(dm_compliance_exports, {
  buildDMComplianceChecklist: () => buildDMComplianceChecklist
});
function buildDMComplianceChecklist(projectId, orgId, project) {
  const typology = (project.ctx01Typology || "Residential").toLowerCase();
  const items = [];
  const pushItem = (code, desc7, status) => {
    items.push({
      code,
      description: desc7,
      status,
      verified: false
    });
  };
  if (typology === "commercial" || typology === "office") {
    pushItem("DCD-FLS", "Fire Life Safety Code (Dubai Civil Defence) Approval", "Mandatory");
    pushItem("DDA-ACC", "DDA Accessibility Guidelines (POD compliant WC)", "Mandatory");
    pushItem("DM-ASH", "ASHRAE Ventilation standard for open plan (Dubai Municipality)", "Mandatory");
    pushItem("DM-STR", "Structural NOC for internal partitions", "Conditional");
  } else if (typology === "hospitality") {
    pushItem("DM-FHS", "F&B Health & Safety (Dubai Municipality Food Safety Dept)", "Mandatory");
    pushItem("DET-CLS", "Dubai Economy & Tourism (DET) Classification requirements", "Mandatory");
    pushItem("DCD-FLS", "Fire Life Safety Code (Dubai Civil Defence)", "Mandatory");
    pushItem("SIRA-CCTV", "SIRA CCTV Layout Approval", "Mandatory");
  } else {
    pushItem("DEV-NOC", "Trakhees / Master Developer NOC (e.g. Nakheel, Emaar, DP)", "Mandatory");
    pushItem("DEWA-LV", "DEWA minor load variation approval", "Conditional");
    pushItem("DM-MOD", "Dubai Municipality Modification Permit", "Mandatory");
  }
  return {
    projectId,
    organizationId: orgId,
    items
  };
}
var init_dm_compliance = __esm({
  "server/engines/design/dm-compliance.ts"() {
    "use strict";
  }
});

// server/engines/board-composer.ts
var board_composer_exports = {};
__export(board_composer_exports, {
  computeBoardSummary: () => computeBoardSummary,
  generateRfqLines: () => generateRfqLines,
  recommendMaterials: () => recommendMaterials
});
function computeBoardSummary(items) {
  const tierDist = {};
  const catDist = {};
  let costLow = 0;
  let costHigh = 0;
  let maxLead = 0;
  const criticalItems = [];
  for (const item of items) {
    tierDist[item.tier] = (tierDist[item.tier] || 0) + 1;
    catDist[item.category] = (catDist[item.category] || 0) + 1;
    costLow += item.costLow;
    costHigh += item.costHigh;
    if (item.leadTimeDays > maxLead) maxLead = item.leadTimeDays;
    if (item.leadTimeBand === "critical" || item.leadTimeDays >= 90) {
      criticalItems.push(item.name);
    }
  }
  return {
    totalItems: items.length,
    estimatedCostLow: costLow,
    estimatedCostHigh: costHigh,
    currency: "AED",
    longestLeadTimeDays: maxLead,
    criticalPathItems: criticalItems,
    tierDistribution: tierDist,
    categoryDistribution: catDist
  };
}
function generateRfqLines(items) {
  return items.map((item, idx) => ({
    lineNo: idx + 1,
    materialName: item.name,
    category: item.category,
    specification: `${item.tier} grade \u2014 ${item.name}`,
    quantity: item.quantity ? `${item.quantity}` : "TBD",
    unit: item.unitOfMeasure || item.costUnit.replace("AED/", ""),
    estimatedUnitCostLow: item.costLow,
    estimatedUnitCostHigh: item.costHigh,
    leadTimeDays: item.leadTimeDays,
    supplierSuggestion: item.supplierName,
    notes: item.notes || ""
  }));
}
function recommendMaterials(catalog, projectTier, maxItems = 10) {
  const tierMap = {
    Mid: ["economy", "mid"],
    "Upper-mid": ["mid", "premium"],
    Luxury: ["premium", "luxury"],
    "Ultra-luxury": ["luxury", "ultra_luxury"]
  };
  const allowedTiers = tierMap[projectTier] || ["mid", "premium"];
  const scored = catalog.filter((m) => allowedTiers.includes(m.tier)).map((m) => ({
    materialId: m.id,
    name: m.name,
    category: m.category,
    tier: m.tier,
    costLow: Number(m.typicalCostLow) || 0,
    costHigh: Number(m.typicalCostHigh) || 0,
    costUnit: m.costUnit || "AED/unit",
    leadTimeDays: m.leadTimeDays || 30,
    leadTimeBand: m.leadTimeBand || "medium",
    supplierName: m.supplierName || "TBD"
  }));
  const byCategory = {};
  for (const item of scored) {
    if (!byCategory[item.category]) byCategory[item.category] = [];
    byCategory[item.category].push(item);
  }
  const result = [];
  for (const [, items] of Object.entries(byCategory)) {
    result.push(...items.slice(0, 2));
  }
  return result.slice(0, maxItems);
}
var init_board_composer = __esm({
  "server/engines/board-composer.ts"() {
    "use strict";
  }
});

// server/engines/board-pdf.ts
var board_pdf_exports = {};
__export(board_pdf_exports, {
  generateBoardPdfHtml: () => generateBoardPdfHtml
});
function formatDate2() {
  return (/* @__PURE__ */ new Date()).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}
function tierColor(tier) {
  const map = {
    economy: "#6b7280",
    mid: "#3b82f6",
    premium: "#8b5cf6",
    luxury: "#d97706",
    ultra_luxury: "#e11d48"
  };
  return map[tier] || "#6b7280";
}
function leadBadgeColor(band) {
  const map = {
    short: "#16a34a",
    medium: "#ca8a04",
    long: "#ea580c",
    critical: "#dc2626"
  };
  return map[band] || "#ca8a04";
}
function generateBoardPdfHtml(input) {
  const { boardName, projectName, items, summary, rfqLines } = input;
  const date = formatDate2();
  const watermark = `MYR-BRD-${Date.now().toString(36)}`;
  const tileCards = items.map((item, idx) => `
    <div class="tile-card">
      <div class="tile-header">
        <span class="tile-num">${idx + 1}</span>
        <span class="tile-name">${item.name}</span>
        <span class="tier-badge" style="background:${tierColor(item.tier)}">${item.tier.replace("_", " ")}</span>
      </div>
      <div class="tile-body">
        <div class="tile-row"><span class="tile-label">Category</span><span>${item.category}</span></div>
        <div class="tile-row"><span class="tile-label">Cost Range</span><span>${item.costLow.toLocaleString()} \u2013 ${item.costHigh.toLocaleString()} ${item.costUnit}</span></div>
        <div class="tile-row"><span class="tile-label">Lead Time</span><span style="color:${leadBadgeColor(item.leadTimeBand)}">${item.leadTimeDays}d (${item.leadTimeBand})</span></div>
        <div class="tile-row"><span class="tile-label">Supplier</span><span>${item.supplierName}</span></div>
        ${item.quantity ? `<div class="tile-row"><span class="tile-label">Quantity</span><span>${item.quantity} ${item.unitOfMeasure || ""}</span></div>` : ""}
        ${item.costBandOverride ? `<div class="tile-row"><span class="tile-label">Cost Band</span><span class="cost-band-badge">${item.costBandOverride}</span></div>` : ""}
        ${item.specNotes ? `<div class="tile-spec">${item.specNotes}</div>` : ""}
        ${item.notes ? `<div class="tile-notes">${item.notes}</div>` : ""}
      </div>
    </div>
  `).join("");
  const rfqRows = rfqLines.map((line) => `
    <tr>
      <td>${line.lineNo}</td>
      <td class="font-medium">${line.materialName}</td>
      <td>${line.category}</td>
      <td>${line.specification}</td>
      <td>${line.quantity}</td>
      <td>${line.unit}</td>
      <td class="text-right">${line.estimatedUnitCostLow.toLocaleString()}</td>
      <td class="text-right">${line.estimatedUnitCostHigh.toLocaleString()}</td>
      <td>${line.leadTimeDays}d</td>
      <td>${line.supplierSuggestion}</td>
      <td>${line.notes}</td>
    </tr>
  `).join("");
  const tierDistRows = Object.entries(summary.tierDistribution).map(([tier, count]) => `
    <div class="dist-item">
      <span class="dist-badge" style="background:${tierColor(tier)}">${tier.replace("_", " ")}</span>
      <span class="dist-count">${count}</span>
    </div>
  `).join("");
  const catDistRows = Object.entries(summary.categoryDistribution).map(([cat, count]) => `
    <div class="dist-item">
      <span class="dist-label">${cat}</span>
      <span class="dist-count">${count}</span>
    </div>
  `).join("");
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  @page { size: A4 landscape; margin: 15mm 12mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1a1a2e; line-height: 1.5; font-size: 10px; }

  .cover { page-break-after: always; display: flex; flex-direction: column; justify-content: center; align-items: center; min-height: 70vh; text-align: center; }
  .cover .logo { font-size: 32px; font-weight: 800; color: #0f3460; letter-spacing: 3px; margin-bottom: 24px; }
  .cover h1 { font-size: 24px; color: #0f3460; margin-bottom: 6px; }
  .cover h2 { font-size: 14px; color: #4ecdc4; font-weight: 400; margin-bottom: 16px; }
  .cover .project { font-size: 18px; color: #1a1a2e; font-weight: 600; }
  .cover .date { font-size: 11px; color: #666; margin-top: 12px; }
  .cover .confidential { font-size: 9px; color: #999; margin-top: 32px; text-transform: uppercase; letter-spacing: 2px; }
  .cover .watermark { font-size: 8px; color: #ccc; margin-top: 6px; font-family: monospace; }

  h2 { font-size: 14px; color: #0f3460; border-bottom: 2px solid #4ecdc4; padding-bottom: 4px; margin: 20px 0 10px; }
  h3 { font-size: 12px; color: #0f3460; margin: 14px 0 6px; }

  .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 12px 0; }
  .summary-card { border: 1px solid #e0e0e0; border-radius: 6px; padding: 10px; text-align: center; }
  .summary-card .label { font-size: 8px; color: #666; text-transform: uppercase; letter-spacing: 1px; }
  .summary-card .value { font-size: 20px; font-weight: 700; color: #0f3460; margin: 2px 0; }
  .summary-card .sub { font-size: 9px; color: #888; }

  .tile-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 12px 0; }
  .tile-card { border: 1px solid #e0e0e0; border-radius: 6px; overflow: hidden; page-break-inside: avoid; }
  .tile-header { display: flex; align-items: center; gap: 6px; padding: 6px 10px; background: #f8f9fa; border-bottom: 1px solid #e0e0e0; }
  .tile-num { font-size: 10px; font-weight: 700; color: #0f3460; background: #e8f4fd; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .tile-name { font-size: 10px; font-weight: 600; flex: 1; }
  .tier-badge { font-size: 8px; color: #fff; padding: 1px 6px; border-radius: 3px; text-transform: uppercase; letter-spacing: 0.5px; }
  .tile-body { padding: 8px 10px; }
  .tile-row { display: flex; justify-content: space-between; font-size: 9px; padding: 2px 0; border-bottom: 1px dotted #f0f0f0; }
  .tile-label { color: #666; font-weight: 500; }
  .tile-spec { font-size: 9px; color: #0f3460; background: #e8f4fd; padding: 4px 6px; border-radius: 3px; margin-top: 4px; font-style: italic; }
  .tile-notes { font-size: 8px; color: #888; margin-top: 3px; }
  .cost-band-badge { background: #fef3c7; color: #92400e; padding: 0 4px; border-radius: 2px; font-weight: 600; }

  table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 9px; }
  th { background: #0f3460; color: #fff; padding: 6px 8px; text-align: left; font-weight: 600; }
  td { padding: 5px 8px; border-bottom: 1px solid #e0e0e0; }
  tr:nth-child(even) td { background: #f8f9fa; }
  .text-right { text-align: right; }
  .font-medium { font-weight: 600; }

  .dist-grid { display: flex; gap: 16px; margin: 8px 0; flex-wrap: wrap; }
  .dist-item { display: flex; align-items: center; gap: 6px; }
  .dist-badge { font-size: 8px; color: #fff; padding: 1px 6px; border-radius: 3px; text-transform: uppercase; }
  .dist-label { font-size: 9px; color: #444; }
  .dist-count { font-size: 11px; font-weight: 700; color: #0f3460; }

  .critical-list { margin: 8px 0; }
  .critical-item { background: #fef2f2; border-left: 3px solid #dc2626; padding: 4px 8px; margin: 3px 0; font-size: 9px; color: #991b1b; }

  .footer { margin-top: 30px; padding-top: 10px; border-top: 1px solid #e0e0e0; font-size: 8px; color: #999; text-align: center; }
  .section { page-break-inside: avoid; margin-bottom: 16px; }
</style>
</head>
<body>

<div class="cover">
  <div class="logo">MIYAR</div>
  <h1>Material Board</h1>
  <h2>${boardName}</h2>
  <div class="project">${projectName}</div>
  <div class="date">${date}</div>
  <div class="confidential">Confidential \u2014 For Internal Use Only</div>
  <div class="watermark">Document ID: ${watermark}</div>
</div>

<div class="section">
  <h2>Board Summary</h2>
  <div class="summary-grid">
    <div class="summary-card">
      <div class="label">Total Items</div>
      <div class="value">${summary.totalItems}</div>
    </div>
    <div class="summary-card">
      <div class="label">Estimated Cost Range</div>
      <div class="value" style="font-size:14px">${summary.estimatedCostLow.toLocaleString()} \u2013 ${summary.estimatedCostHigh.toLocaleString()}</div>
      <div class="sub">${summary.currency}</div>
    </div>
    <div class="summary-card">
      <div class="label">Longest Lead Time</div>
      <div class="value">${summary.longestLeadTimeDays}d</div>
    </div>
    <div class="summary-card">
      <div class="label">Critical Path Items</div>
      <div class="value">${summary.criticalPathItems.length}</div>
    </div>
  </div>

  <h3>Tier Distribution</h3>
  <div class="dist-grid">${tierDistRows}</div>

  <h3>Category Distribution</h3>
  <div class="dist-grid">${catDistRows}</div>

  ${summary.criticalPathItems.length > 0 ? `
  <h3>Critical Path Items</h3>
  <div class="critical-list">
    ${summary.criticalPathItems.map((item) => `<div class="critical-item">${item}</div>`).join("")}
  </div>
  ` : ""}
</div>

<div class="section">
  <h2>Material Tiles</h2>
  <div class="tile-grid">
    ${tileCards}
  </div>
</div>

<div class="section">
  <h2>RFQ-Ready Procurement Schedule</h2>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Material</th>
        <th>Category</th>
        <th>Specification</th>
        <th>Qty</th>
        <th>Unit</th>
        <th class="text-right">Cost Low (AED)</th>
        <th class="text-right">Cost High (AED)</th>
        <th>Lead</th>
        <th>Supplier</th>
        <th>Notes</th>
      </tr>
    </thead>
    <tbody>
      ${rfqRows}
    </tbody>
  </table>
</div>

<div class="footer">
  MIYAR Decision Intelligence Platform \u2014 Material Board Export \u2014 ${date} \u2014 ${watermark}<br/>
  This document is auto-generated. All cost estimates are indicative and subject to supplier confirmation.
</div>

</body>
</html>`;
}
var init_board_pdf = __esm({
  "server/engines/board-pdf.ts"() {
    "use strict";
  }
});

// api-src/index.ts
import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

// server/_core/oauth.ts
function registerOAuthRoutes(app2) {
}

// server/_core/systemRouter.ts
import { z } from "zod";

// server/_core/notification.ts
import { TRPCError } from "@trpc/server";
var TITLE_MAX_LENGTH = 1200;
var CONTENT_MAX_LENGTH = 2e4;
var trimValue = (value) => value.trim();
var isNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0;
var buildEndpointUrl = () => {
  return "https://api.resend.com/emails";
};
var validatePayload = (input) => {
  if (!isNonEmptyString(input.title)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification title is required."
    });
  }
  if (!isNonEmptyString(input.content)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification content is required."
    });
  }
  const title = trimValue(input.title);
  const content = trimValue(input.content);
  if (title.length > TITLE_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.`
    });
  }
  if (content.length > CONTENT_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.`
    });
  }
  return { title, content };
};
async function notifyOwner(payload) {
  const { title, content } = validatePayload(payload);
  if (!process.env.RESEND_API_KEY) {
    console.log(`[Notification Mock] Would have sent email to owner.`);
    console.log(`[Notification Mock] Title: ${title}`);
    console.log(`[Notification Mock] Content: ${content}`);
    return true;
  }
  const endpoint = buildEndpointUrl();
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        from: "miyar-v2 <onboarding@resend.dev>",
        to: ["admin@example.com"],
        // Hardcoded for demo/handover
        subject: title,
        html: `<p>${content}</p>`
      })
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.warn(
        `[Notification] Failed to notify owner (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
      );
      return false;
    }
    return true;
  } catch (error) {
    console.warn("[Notification] Error calling notification service:", error);
    return false;
  }
}

// shared/const.ts
var COOKIE_NAME = "app_session_id";
var ONE_YEAR_MS = 1e3 * 60 * 60 * 24 * 365;
var UNAUTHED_ERR_MSG = "Please login (10001)";
var NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";

// server/_core/trpc.ts
import { initTRPC, TRPCError as TRPCError2 } from "@trpc/server";
import superjson from "superjson";
var t = initTRPC.context().create({
  transformer: superjson
});
var router = t.router;
var publicProcedure = t.procedure;
var requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  if (!ctx.user) {
    throw new TRPCError2({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user
    }
  });
});
var protectedProcedure = t.procedure.use(requireUser);
var adminProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    if (!ctx.user || ctx.user.role !== "admin") {
      throw new TRPCError2({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user
      }
    });
  })
);
var requireOrg = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  if (!ctx.user) {
    throw new TRPCError2({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  if (!ctx.user.orgId) {
    throw new TRPCError2({ code: "FORBIDDEN", message: "User does not belong to an organization" });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
      orgId: ctx.user.orgId
    }
  });
});
var orgProcedure = t.procedure.use(requireOrg);

// server/_core/systemRouter.ts
var systemRouter = router({
  health: publicProcedure.input(
    z.object({
      timestamp: z.number().min(0, "timestamp cannot be negative")
    })
  ).query(() => ({
    ok: true
  })),
  notifyOwner: adminProcedure.input(
    z.object({
      title: z.string().min(1, "title is required"),
      content: z.string().min(1, "content is required")
    })
  ).mutation(async ({ input }) => {
    const delivered = await notifyOwner(input);
    return {
      success: delivered
    };
  })
});

// server/routers/auth.ts
import { z as z2 } from "zod";

// server/db.ts
import { eq, and, desc, sql, inArray, gte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2";

// drizzle/schema.ts
import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  decimal,
  boolean,
  json
} from "drizzle-orm/mysql-core";
var users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  password: varchar("password", { length: 255 }),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
  orgId: int("orgId")
  // added in V7 for backward compat later to be notNull
});
var organizations = mysqlTable("organizations", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  domain: varchar("domain", { length: 255 }),
  plan: mysqlEnum("plan", ["free", "pro", "enterprise"]).default("free").notNull(),
  stripeCustomerId: varchar("stripeCustomerId", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var organizationMembers = mysqlTable("organization_members", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull(),
  userId: int("userId").notNull(),
  role: mysqlEnum("role", ["admin", "member", "viewer"]).default("member").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var organizationInvites = mysqlTable("organization_invites", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  role: mysqlEnum("role", ["admin", "member", "viewer"]).default("member").notNull(),
  token: varchar("token", { length: 255 }).notNull().unique(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var modelVersions = mysqlTable("model_versions", {
  id: int("id").autoincrement().primaryKey(),
  versionTag: varchar("versionTag", { length: 32 }).notNull().unique(),
  dimensionWeights: json("dimensionWeights").notNull(),
  variableWeights: json("variableWeights").notNull(),
  penaltyConfig: json("penaltyConfig").notNull(),
  isActive: boolean("isActive").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  createdBy: int("createdBy"),
  notes: text("notes")
});
var benchmarkVersions = mysqlTable("benchmark_versions", {
  id: int("id").autoincrement().primaryKey(),
  versionTag: varchar("versionTag", { length: 64 }).notNull().unique(),
  description: text("description"),
  status: mysqlEnum("status", ["draft", "published", "archived"]).default("draft").notNull(),
  publishedAt: timestamp("publishedAt"),
  publishedBy: int("publishedBy"),
  recordCount: int("recordCount").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  createdBy: int("createdBy")
});
var benchmarkCategories = mysqlTable("benchmark_categories", {
  id: int("id").autoincrement().primaryKey(),
  category: mysqlEnum("category", [
    "materials",
    "finishes",
    "ffe",
    "procurement",
    "cost_bands",
    "tier_definitions",
    "style_families",
    "brand_archetypes",
    "risk_factors",
    "lead_times"
  ]).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  market: varchar("market", { length: 64 }).default("UAE").notNull(),
  submarket: varchar("submarket", { length: 64 }).default("Dubai"),
  projectClass: mysqlEnum("projectClass", ["mid", "upper", "luxury", "ultra_luxury"]).notNull(),
  validFrom: timestamp("validFrom"),
  validTo: timestamp("validTo"),
  confidenceLevel: mysqlEnum("confidenceLevel", ["high", "medium", "low"]).default("medium"),
  sourceType: mysqlEnum("sourceType", ["manual", "admin", "imported", "curated"]).default("admin"),
  benchmarkVersionId: int("benchmarkVersionId"),
  data: json("data").notNull(),
  versionTag: varchar("versionTag", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  createdBy: int("createdBy")
});
var projects = mysqlTable("projects", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  orgId: int("orgId"),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  status: mysqlEnum("status", [
    "draft",
    "ready",
    "processing",
    "evaluated",
    "locked"
  ]).default("draft").notNull(),
  // Approval gate (V2.8)
  approvalState: mysqlEnum("approvalState", [
    "draft",
    "review",
    "approved_rfq",
    "approved_marketing"
  ]).default("draft"),
  // Context variables
  ctx01Typology: mysqlEnum("ctx01Typology", [
    "Residential",
    "Mixed-use",
    "Hospitality",
    "Office"
  ]).default("Residential"),
  ctx02Scale: mysqlEnum("ctx02Scale", ["Small", "Medium", "Large"]).default(
    "Medium"
  ),
  ctx03Gfa: decimal("ctx03Gfa", { precision: 12, scale: 2 }),
  ctx04Location: mysqlEnum("ctx04Location", [
    "Prime",
    "Secondary",
    "Emerging"
  ]).default("Secondary"),
  ctx05Horizon: mysqlEnum("ctx05Horizon", [
    "0-12m",
    "12-24m",
    "24-36m",
    "36m+"
  ]).default("12-24m"),
  // Strategy variables (1-5)
  str01BrandClarity: int("str01BrandClarity").default(3),
  str02Differentiation: int("str02Differentiation").default(3),
  str03BuyerMaturity: int("str03BuyerMaturity").default(3),
  // Market variables
  mkt01Tier: mysqlEnum("mkt01Tier", [
    "Mid",
    "Upper-mid",
    "Luxury",
    "Ultra-luxury"
  ]).default("Upper-mid"),
  mkt02Competitor: int("mkt02Competitor").default(3),
  mkt03Trend: int("mkt03Trend").default(3),
  // Financial variables
  fin01BudgetCap: decimal("fin01BudgetCap", { precision: 10, scale: 2 }),
  fin02Flexibility: int("fin02Flexibility").default(3),
  fin03ShockTolerance: int("fin03ShockTolerance").default(3),
  fin04SalesPremium: int("fin04SalesPremium").default(3),
  // Design variables
  des01Style: mysqlEnum("des01Style", [
    "Modern",
    "Contemporary",
    "Minimal",
    "Classic",
    "Fusion",
    "Other"
  ]).default("Modern"),
  des02MaterialLevel: int("des02MaterialLevel").default(3),
  des03Complexity: int("des03Complexity").default(3),
  des04Experience: int("des04Experience").default(3),
  des05Sustainability: int("des05Sustainability").default(2),
  // Execution variables
  exe01SupplyChain: int("exe01SupplyChain").default(3),
  exe02Contractor: int("exe02Contractor").default(3),
  exe03Approvals: int("exe03Approvals").default(2),
  exe04QaMaturity: int("exe04QaMaturity").default(3),
  // Add-on variables
  add01SampleKit: boolean("add01SampleKit").default(false),
  add02PortfolioMode: boolean("add02PortfolioMode").default(false),
  add03DashboardExport: boolean("add03DashboardExport").default(true),
  modelVersionId: int("modelVersionId"),
  benchmarkVersionId: int("benchmarkVersionId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lockedAt: timestamp("lockedAt")
});
var directionCandidates = mysqlTable("direction_candidates", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  isPrimary: boolean("isPrimary").default(false),
  des01Style: mysqlEnum("des01Style", [
    "Modern",
    "Contemporary",
    "Minimal",
    "Classic",
    "Fusion",
    "Other"
  ]),
  des02MaterialLevel: int("des02MaterialLevel"),
  des03Complexity: int("des03Complexity"),
  des04Experience: int("des04Experience"),
  fin01BudgetCap: decimal("fin01BudgetCap", { precision: 10, scale: 2 }),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var scoreMatrices = mysqlTable("score_matrices", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  directionId: int("directionId"),
  modelVersionId: int("modelVersionId").notNull(),
  benchmarkVersionId: int("benchmarkVersionId"),
  saScore: decimal("saScore", { precision: 6, scale: 2 }).notNull(),
  ffScore: decimal("ffScore", { precision: 6, scale: 2 }).notNull(),
  mpScore: decimal("mpScore", { precision: 6, scale: 2 }).notNull(),
  dsScore: decimal("dsScore", { precision: 6, scale: 2 }).notNull(),
  erScore: decimal("erScore", { precision: 6, scale: 2 }).notNull(),
  compositeScore: decimal("compositeScore", {
    precision: 6,
    scale: 2
  }).notNull(),
  riskScore: decimal("riskScore", { precision: 6, scale: 2 }).notNull(),
  rasScore: decimal("rasScore", { precision: 6, scale: 2 }).notNull(),
  confidenceScore: decimal("confidenceScore", {
    precision: 6,
    scale: 2
  }).notNull(),
  decisionStatus: mysqlEnum("decisionStatus", [
    "validated",
    "conditional",
    "not_validated"
  ]).notNull(),
  penalties: json("penalties"),
  riskFlags: json("riskFlags"),
  dimensionWeights: json("dimensionWeights").notNull(),
  variableContributions: json("variableContributions").notNull(),
  conditionalActions: json("conditionalActions"),
  inputSnapshot: json("inputSnapshot").notNull(),
  budgetFitMethod: varchar("budgetFitMethod", { length: 32 }),
  computedAt: timestamp("computedAt").defaultNow().notNull()
});
var scenarios = mysqlTable("scenarios", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  orgId: int("orgId"),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  variableOverrides: json("variableOverrides"),
  isTemplate: boolean("isTemplate").default(false),
  templateKey: varchar("templateKey", { length: 64 }),
  scoreMatrixId: int("scoreMatrixId"),
  rasScore: decimal("rasScore", { precision: 6, scale: 2 }),
  isDominant: boolean("isDominant").default(false),
  stabilityScore: decimal("stabilityScore", { precision: 6, scale: 2 }),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var benchmarkData = mysqlTable("benchmark_data", {
  id: int("id").autoincrement().primaryKey(),
  typology: varchar("typology", { length: 64 }).notNull(),
  location: varchar("location", { length: 64 }).notNull(),
  marketTier: varchar("marketTier", { length: 64 }).notNull(),
  materialLevel: int("materialLevel").notNull(),
  roomType: varchar("roomType", { length: 64 }).default("General"),
  costPerSqftLow: decimal("costPerSqftLow", { precision: 10, scale: 2 }),
  costPerSqftMid: decimal("costPerSqftMid", { precision: 10, scale: 2 }),
  costPerSqftHigh: decimal("costPerSqftHigh", { precision: 10, scale: 2 }),
  avgSellingPrice: decimal("avgSellingPrice", { precision: 10, scale: 2 }),
  absorptionRate: decimal("absorptionRate", { precision: 6, scale: 4 }),
  competitiveDensity: int("competitiveDensity"),
  differentiationIndex: decimal("differentiationIndex", { precision: 6, scale: 4 }),
  complexityMultiplier: decimal("complexityMultiplier", { precision: 6, scale: 4 }),
  timelineRiskMultiplier: decimal("timelineRiskMultiplier", { precision: 6, scale: 4 }),
  buyerPreferenceWeights: json("buyerPreferenceWeights"),
  sourceType: mysqlEnum("sourceType", [
    "synthetic",
    "client_provided",
    "curated"
  ]).default("synthetic"),
  sourceNote: text("sourceNote"),
  dataYear: int("dataYear"),
  region: varchar("region", { length: 64 }).default("UAE"),
  benchmarkVersionId: int("benchmarkVersionId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var projectIntelligence = mysqlTable("project_intelligence", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  scoreMatrixId: int("scoreMatrixId").notNull(),
  benchmarkVersionId: int("benchmarkVersionId"),
  modelVersionId: int("modelVersionId"),
  costDeltaVsBenchmark: decimal("costDeltaVsBenchmark", { precision: 10, scale: 2 }),
  uniquenessIndex: decimal("uniquenessIndex", { precision: 6, scale: 4 }),
  feasibilityFlags: json("feasibilityFlags"),
  reworkRiskIndex: decimal("reworkRiskIndex", { precision: 6, scale: 4 }),
  procurementComplexity: decimal("procurementComplexity", { precision: 6, scale: 4 }),
  tierPercentile: decimal("tierPercentile", { precision: 6, scale: 4 }),
  styleFamily: varchar("styleFamily", { length: 64 }),
  costBand: varchar("costBand", { length: 32 }),
  inputSnapshot: json("inputSnapshot"),
  scoreSnapshot: json("scoreSnapshot"),
  computedAt: timestamp("computedAt").defaultNow().notNull()
});
var reportInstances = mysqlTable("report_instances", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  scoreMatrixId: int("scoreMatrixId").notNull(),
  reportType: mysqlEnum("reportType", [
    "executive_pack",
    "full_technical",
    "tender_brief",
    "executive_decision_pack",
    "design_brief_rfq",
    "marketing_starter",
    "validation_summary",
    "design_brief",
    "rfq_pack",
    "full_report",
    "marketing_prelaunch"
  ]).notNull(),
  fileUrl: text("fileUrl"),
  bundleUrl: text("bundleUrl"),
  content: json("content"),
  benchmarkVersionId: int("benchmarkVersionId"),
  modelVersionId: int("modelVersionId"),
  generatedAt: timestamp("generatedAt").defaultNow().notNull(),
  generatedBy: int("generatedBy")
});
var roiConfigs = mysqlTable("roi_configs", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 128 }).notNull(),
  isActive: boolean("isActive").default(false).notNull(),
  hourlyRate: decimal("hourlyRate", { precision: 10, scale: 2 }).default("350").notNull(),
  reworkCostPct: decimal("reworkCostPct", { precision: 6, scale: 4 }).default("0.12").notNull(),
  tenderIterationCost: decimal("tenderIterationCost", { precision: 10, scale: 2 }).default("25000").notNull(),
  designCycleCost: decimal("designCycleCost", { precision: 10, scale: 2 }).default("45000").notNull(),
  budgetVarianceMultiplier: decimal("budgetVarianceMultiplier", { precision: 6, scale: 4 }).default("0.08").notNull(),
  timeAccelerationWeeks: int("timeAccelerationWeeks").default(6),
  conservativeMultiplier: decimal("conservativeMultiplier", { precision: 6, scale: 4 }).default("0.60").notNull(),
  aggressiveMultiplier: decimal("aggressiveMultiplier", { precision: 6, scale: 4 }).default("1.40").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  createdBy: int("createdBy")
});
var webhookConfigs = mysqlTable("webhook_configs", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  url: text("url").notNull(),
  secret: varchar("secret", { length: 255 }),
  events: json("events").notNull(),
  fieldMapping: json("fieldMapping"),
  isActive: boolean("isActive").default(true).notNull(),
  lastTriggeredAt: timestamp("lastTriggeredAt"),
  lastStatus: int("lastStatus"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  createdBy: int("createdBy")
});
var projectAssets = mysqlTable("project_assets", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  filename: varchar("filename", { length: 512 }).notNull(),
  mimeType: varchar("mimeType", { length: 128 }).notNull(),
  sizeBytes: int("sizeBytes").notNull(),
  storagePath: text("storagePath").notNull(),
  storageUrl: text("storageUrl"),
  checksum: varchar("checksum", { length: 128 }),
  uploadedBy: int("uploadedBy").notNull(),
  category: mysqlEnum("category", [
    "brief",
    "brand",
    "budget",
    "competitor",
    "inspiration",
    "material",
    "sales",
    "legal",
    "mood_image",
    "material_board",
    "marketing_hero",
    "generated",
    "other"
  ]).default("other").notNull(),
  tags: json("tags"),
  // string[]
  notes: text("notes"),
  isClientVisible: boolean("isClientVisible").default(true).notNull(),
  uploadedAt: timestamp("uploadedAt").defaultNow().notNull()
});
var assetLinks = mysqlTable("asset_links", {
  id: int("id").autoincrement().primaryKey(),
  assetId: int("assetId").notNull(),
  linkType: mysqlEnum("linkType", [
    "evaluation",
    "report",
    "scenario",
    "material_board",
    "design_brief",
    "visual"
  ]).notNull(),
  linkId: int("linkId").notNull(),
  // ID of the linked entity
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var designBriefs = mysqlTable("design_briefs", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  scenarioId: int("scenarioId"),
  // optional: brief for a specific scenario
  version: int("version").default(1).notNull(),
  // 7 sections as JSON
  projectIdentity: json("projectIdentity").notNull(),
  positioningStatement: text("positioningStatement").notNull(),
  styleMood: json("styleMood").notNull(),
  materialGuidance: json("materialGuidance").notNull(),
  budgetGuardrails: json("budgetGuardrails").notNull(),
  procurementConstraints: json("procurementConstraints").notNull(),
  deliverablesChecklist: json("deliverablesChecklist").notNull(),
  // Metadata
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var generatedVisuals = mysqlTable("generated_visuals", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  scenarioId: int("scenarioId"),
  type: mysqlEnum("type", ["mood", "material_board", "hero"]).notNull(),
  promptJson: json("promptJson").notNull(),
  modelVersion: varchar("modelVersion", { length: 64 }).default("nano-banana-v1"),
  imageAssetId: int("imageAssetId"),
  // FK to project_assets
  status: mysqlEnum("status", ["pending", "generating", "completed", "failed"]).default("pending").notNull(),
  errorMessage: text("errorMessage"),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var materialBoards = mysqlTable("material_boards", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  scenarioId: int("scenarioId"),
  boardName: varchar("boardName", { length: 255 }).notNull(),
  boardJson: json("boardJson").notNull(),
  // materials/finishes/ff&e items
  boardImageAssetId: int("boardImageAssetId"),
  // FK to project_assets
  benchmarkVersionId: int("benchmarkVersionId"),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var materialsCatalog = mysqlTable("materials_catalog", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  category: mysqlEnum("category", [
    "tile",
    "stone",
    "wood",
    "metal",
    "fabric",
    "glass",
    "paint",
    "wallpaper",
    "lighting",
    "furniture",
    "fixture",
    "accessory",
    "other"
  ]).notNull(),
  tier: mysqlEnum("tier", ["economy", "mid", "premium", "luxury", "ultra_luxury"]).notNull(),
  typicalCostLow: decimal("typicalCostLow", { precision: 10, scale: 2 }),
  typicalCostHigh: decimal("typicalCostHigh", { precision: 10, scale: 2 }),
  costUnit: varchar("costUnit", { length: 32 }).default("AED/sqm"),
  leadTimeDays: int("leadTimeDays"),
  leadTimeBand: mysqlEnum("leadTimeBand", ["short", "medium", "long", "critical"]).default("medium"),
  regionAvailability: json("regionAvailability"),
  // string[]
  supplierName: varchar("supplierName", { length: 255 }),
  supplierContact: varchar("supplierContact", { length: 255 }),
  supplierUrl: text("supplierUrl"),
  imageUrl: text("imageUrl"),
  notes: text("notes"),
  isActive: boolean("isActive").default(true).notNull(),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var materialsToBoards = mysqlTable("materials_to_boards", {
  id: int("id").autoincrement().primaryKey(),
  boardId: int("boardId").notNull(),
  materialId: int("materialId").notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 2 }),
  unitOfMeasure: varchar("unitOfMeasure", { length: 32 }),
  notes: text("notes"),
  sortOrder: int("sortOrder").default(0).notNull(),
  specNotes: text("specNotes"),
  costBandOverride: varchar("costBandOverride", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var promptTemplates = mysqlTable("prompt_templates", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId"),
  name: varchar("name", { length: 255 }).notNull(),
  type: mysqlEnum("type", ["mood", "material_board", "hero"]).notNull(),
  templateText: text("templateText").notNull(),
  variables: json("variables").notNull(),
  // string[] of variable names
  isActive: boolean("isActive").default(true).notNull(),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var comments = mysqlTable("comments", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  entityType: mysqlEnum("entityType", [
    "design_brief",
    "material_board",
    "visual",
    "general"
  ]).notNull(),
  entityId: int("entityId"),
  userId: int("userId").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var auditLogs = mysqlTable("audit_logs", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId"),
  userId: int("userId"),
  action: varchar("action", { length: 128 }).notNull(),
  entityType: varchar("entityType", { length: 64 }).notNull(),
  entityId: int("entityId"),
  details: json("details"),
  benchmarkVersionId: int("benchmarkVersionId"),
  modelVersionId: int("modelVersionId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  ipAddress: varchar("ipAddress", { length: 64 })
});
var overrideRecords = mysqlTable("override_records", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  userId: int("userId").notNull(),
  overrideType: mysqlEnum("overrideType", [
    "strategic",
    "market_insight",
    "risk_adjustment",
    "experimental"
  ]).notNull(),
  authorityLevel: int("authorityLevel").notNull(),
  originalValue: json("originalValue").notNull(),
  overrideValue: json("overrideValue").notNull(),
  justification: text("justification").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var logicVersions = mysqlTable("logic_versions", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 128 }).notNull(),
  status: mysqlEnum("status", ["draft", "published", "archived"]).default("draft").notNull(),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  publishedAt: timestamp("publishedAt"),
  notes: text("notes")
});
var logicWeights = mysqlTable("logic_weights", {
  id: int("id").autoincrement().primaryKey(),
  logicVersionId: int("logicVersionId").notNull(),
  dimension: varchar("dimension", { length: 32 }).notNull(),
  // sa, ff, mp, ds, er
  weight: decimal("weight", { precision: 6, scale: 4 }).notNull()
});
var logicThresholds = mysqlTable("logic_thresholds", {
  id: int("id").autoincrement().primaryKey(),
  logicVersionId: int("logicVersionId").notNull(),
  ruleKey: varchar("ruleKey", { length: 128 }).notNull(),
  thresholdValue: decimal("thresholdValue", { precision: 10, scale: 4 }).notNull(),
  comparator: mysqlEnum("comparator", ["gt", "gte", "lt", "lte", "eq", "neq"]).notNull(),
  notes: text("notes")
});
var logicChangeLog = mysqlTable("logic_change_log", {
  id: int("id").autoincrement().primaryKey(),
  logicVersionId: int("logicVersionId").notNull(),
  actor: int("actor").notNull(),
  changeSummary: text("changeSummary").notNull(),
  rationale: text("rationale").notNull(),
  status: mysqlEnum("status", ["applied", "proposed", "rejected"]).default("applied").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var decisionPatterns = mysqlTable("decision_patterns", {
  id: int("id").autoincrement().primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  category: mysqlEnum("category", ["risk_indicator", "success_driver", "cost_anomaly"]).notNull(),
  conditions: json("conditions").notNull(),
  // array of logic defining the pattern
  matchCount: int("matchCount").default(0).notNull(),
  // times it appeared
  reliabilityScore: decimal("reliabilityScore", { precision: 5, scale: 2 }).default("0.00").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var projectPatternMatches = mysqlTable("project_pattern_matches", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  patternId: int("patternId").notNull(),
  matchedAt: timestamp("matchedAt").defaultNow().notNull(),
  confidence: decimal("confidence", { precision: 5, scale: 2 }).default("1.00").notNull(),
  contextSnapshot: json("contextSnapshot")
  // snapshot of scores during match
});
var scenarioInputs = mysqlTable("scenario_inputs", {
  id: int("id").autoincrement().primaryKey(),
  scenarioId: int("scenarioId").notNull(),
  jsonInput: json("jsonInput").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var scenarioOutputs = mysqlTable("scenario_outputs", {
  id: int("id").autoincrement().primaryKey(),
  scenarioId: int("scenarioId").notNull(),
  scoreJson: json("scoreJson").notNull(),
  roiJson: json("roiJson"),
  riskJson: json("riskJson"),
  boardCostJson: json("boardCostJson"),
  benchmarkVersionId: int("benchmarkVersionId"),
  logicVersionId: int("logicVersionId"),
  computedAt: timestamp("computedAt").defaultNow().notNull()
});
var scenarioComparisons = mysqlTable("scenario_comparisons", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  baselineScenarioId: int("baselineScenarioId").notNull(),
  comparedScenarioIds: json("comparedScenarioIds").notNull(),
  // number[]
  decisionNote: text("decisionNote"),
  comparisonResult: json("comparisonResult"),
  // computed tradeoffs
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var projectOutcomes = mysqlTable("project_outcomes", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  procurementActualCosts: json("procurementActualCosts"),
  leadTimesActual: json("leadTimesActual"),
  rfqResults: json("rfqResults"),
  adoptionMetrics: json("adoptionMetrics"),
  // V5 Fields
  actualFitoutCostPerSqm: decimal("actualFitoutCostPerSqm", { precision: 10, scale: 2 }),
  actualTotalCost: decimal("actualTotalCost", { precision: 15, scale: 2 }),
  projectDeliveredOnTime: boolean("projectDeliveredOnTime"),
  reworkOccurred: boolean("reworkOccurred"),
  reworkCostAed: decimal("reworkCostAed", { precision: 15, scale: 2 }),
  clientSatisfactionScore: int("clientSatisfactionScore"),
  tenderIterations: int("tenderIterations"),
  keyLessonsLearned: text("keyLessonsLearned"),
  capturedAt: timestamp("capturedAt").defaultNow().notNull(),
  capturedBy: int("capturedBy")
});
var outcomeComparisons = mysqlTable("outcome_comparisons", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  comparedAt: timestamp("comparedAt").defaultNow().notNull(),
  // Cost accuracy
  predictedCostMid: decimal("predictedCostMid", { precision: 15, scale: 2 }),
  actualCost: decimal("actualCost", { precision: 15, scale: 2 }),
  costDeltaPct: decimal("costDeltaPct", { precision: 10, scale: 4 }),
  costAccuracyBand: mysqlEnum("costAccuracyBand", ["within_10pct", "within_20pct", "outside_20pct", "no_prediction"]).notNull(),
  // Score accuracy
  predictedComposite: decimal("predictedComposite", { precision: 5, scale: 4 }).notNull(),
  predictedDecision: varchar("predictedDecision", { length: 64 }).notNull(),
  actualOutcomeSuccess: boolean("actualOutcomeSuccess").notNull(),
  scorePredictionCorrect: boolean("scorePredictionCorrect").notNull(),
  // Risk accuracy
  predictedRisk: decimal("predictedRisk", { precision: 5, scale: 4 }).notNull(),
  actualReworkOccurred: boolean("actualReworkOccurred").notNull(),
  riskPredictionCorrect: boolean("riskPredictionCorrect").notNull(),
  // Delta summary
  overallAccuracyGrade: mysqlEnum("overallAccuracyGrade", ["A", "B", "C", "insufficient_data"]).notNull(),
  learningSignals: json("learningSignals"),
  rawComparison: json("rawComparison")
});
var accuracySnapshots = mysqlTable("accuracy_snapshots", {
  id: int("id").autoincrement().primaryKey(),
  snapshotDate: timestamp("snapshotDate").defaultNow().notNull(),
  totalComparisons: int("totalComparisons").notNull(),
  withCostPrediction: int("withCostPrediction").notNull(),
  withOutcomePrediction: int("withOutcomePrediction").notNull(),
  // Cost accuracy
  costWithin10Pct: int("costWithin10Pct").notNull(),
  costWithin20Pct: int("costWithin20Pct").notNull(),
  costOutside20Pct: int("costOutside20Pct").notNull(),
  costMaePct: decimal("costMaePct", { precision: 8, scale: 4 }),
  costTrend: mysqlEnum("costTrend", ["improving", "stable", "degrading", "insufficient_data"]).notNull(),
  // Score accuracy
  scoreCorrectPredictions: int("scoreCorrectPredictions").notNull(),
  scoreIncorrectPredictions: int("scoreIncorrectPredictions").notNull(),
  scoreAccuracyRate: decimal("scoreAccuracyRate", { precision: 8, scale: 4 }).notNull(),
  scoreTrend: mysqlEnum("scoreTrend", ["improving", "stable", "degrading", "insufficient_data"]).notNull(),
  // Risk accuracy
  riskCorrectPredictions: int("riskCorrectPredictions").notNull(),
  riskIncorrectPredictions: int("riskIncorrectPredictions").notNull(),
  riskAccuracyRate: decimal("riskAccuracyRate", { precision: 8, scale: 4 }).notNull(),
  riskTrend: mysqlEnum("riskTrend", ["improving", "stable", "degrading", "insufficient_data"]).notNull(),
  overallPlatformAccuracy: decimal("overallPlatformAccuracy", { precision: 8, scale: 4 }).notNull(),
  gradeA: int("gradeA").notNull(),
  gradeB: int("gradeB").notNull(),
  gradeC: int("gradeC").notNull()
});
var benchmarkSuggestions = mysqlTable("benchmark_suggestions", {
  id: int("id").autoincrement().primaryKey(),
  basedOnOutcomesQuery: text("basedOnOutcomesQuery"),
  suggestedChanges: json("suggestedChanges").notNull(),
  confidence: decimal("confidence", { precision: 6, scale: 4 }),
  status: mysqlEnum("status", ["pending", "accepted", "rejected"]).default("pending").notNull(),
  reviewerNotes: text("reviewerNotes"),
  reviewedBy: int("reviewedBy"),
  reviewedAt: timestamp("reviewedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var sourceRegistry = mysqlTable("source_registry", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  url: text("url").notNull(),
  sourceType: mysqlEnum("sourceType", [
    "supplier_catalog",
    "manufacturer_catalog",
    "developer_brochure",
    "industry_report",
    "government_tender",
    "procurement_portal",
    "trade_publication",
    "retailer_listing",
    "aggregator",
    "other"
  ]).notNull(),
  reliabilityDefault: mysqlEnum("reliabilityDefault", ["A", "B", "C"]).default("B").notNull(),
  isWhitelisted: boolean("isWhitelisted").default(true).notNull(),
  region: varchar("region", { length: 64 }).default("UAE"),
  notes: text("notes"),
  addedBy: int("addedBy"),
  isActive: boolean("isActive").default(true).notNull(),
  lastSuccessfulFetch: timestamp("lastSuccessfulFetch"),
  // DFE Fields
  scrapeConfig: json("scrapeConfig"),
  scrapeSchedule: varchar("scrapeSchedule", { length: 64 }),
  scrapeMethod: mysqlEnum("scrapeMethod", [
    "html_llm",
    "html_rules",
    "json_api",
    "rss_feed",
    "csv_upload",
    "email_forward"
  ]).default("html_llm").notNull(),
  scrapeHeaders: json("scrapeHeaders"),
  extractionHints: text("extractionHints"),
  priceFieldMapping: json("priceFieldMapping"),
  lastScrapedAt: timestamp("lastScrapedAt"),
  lastScrapedStatus: mysqlEnum("lastScrapedStatus", ["success", "partial", "failed", "never"]).default("never").notNull(),
  lastRecordCount: int("lastRecordCount").default(0).notNull(),
  consecutiveFailures: int("consecutiveFailures").default(0).notNull(),
  requestDelayMs: int("requestDelayMs").default(2e3).notNull(),
  addedAt: timestamp("addedAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var evidenceRecords = mysqlTable("evidence_records", {
  id: int("id").autoincrement().primaryKey(),
  recordId: varchar("recordId", { length: 64 }).notNull().unique(),
  // MYR-PE-XXXX
  projectId: int("projectId"),
  // optional: can be global evidence
  orgId: int("orgId"),
  sourceRegistryId: int("sourceRegistryId"),
  // FK to source_registry
  category: mysqlEnum("category", [
    "floors",
    "walls",
    "ceilings",
    "joinery",
    "lighting",
    "sanitary",
    "kitchen",
    "hardware",
    "ffe",
    "other"
  ]).notNull(),
  itemName: varchar("itemName", { length: 255 }).notNull(),
  specClass: varchar("specClass", { length: 128 }),
  priceMin: decimal("priceMin", { precision: 12, scale: 2 }),
  priceTypical: decimal("priceTypical", { precision: 12, scale: 2 }),
  priceMax: decimal("priceMax", { precision: 12, scale: 2 }),
  unit: varchar("unit", { length: 32 }).notNull(),
  // sqm, lm, set, piece, etc.
  currencyOriginal: varchar("currencyOriginal", { length: 8 }).default("AED"),
  currencyAed: decimal("currencyAed", { precision: 12, scale: 2 }),
  // normalized to AED
  fxRate: decimal("fxRate", { precision: 10, scale: 6 }),
  fxSource: text("fxSource"),
  sourceUrl: text("sourceUrl").notNull(),
  publisher: varchar("publisher", { length: 255 }),
  captureDate: timestamp("captureDate").notNull(),
  reliabilityGrade: mysqlEnum("reliabilityGrade", ["A", "B", "C"]).notNull(),
  confidenceScore: int("confidenceScore").notNull(),
  // 0-100
  extractedSnippet: text("extractedSnippet"),
  notes: text("notes"),
  // V2.2 metadata fields
  title: varchar("title", { length: 512 }),
  evidencePhase: mysqlEnum("evidencePhase", ["concept", "schematic", "detailed_design", "tender", "procurement", "construction", "handover"]),
  author: varchar("author", { length: 255 }),
  confidentiality: mysqlEnum("confidentiality", ["public", "internal", "confidential", "restricted"]).default("internal"),
  tags: json("tags"),
  // string[]
  fileUrl: text("fileUrl"),
  // S3 signed URL for attached evidence file
  fileKey: varchar("fileKey", { length: 512 }),
  // S3 key for the file
  fileMimeType: varchar("fileMimeType", { length: 128 }),
  runId: varchar("runId", { length: 64 }),
  // links to intelligence_audit_log
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var benchmarkProposals = mysqlTable("benchmark_proposals", {
  id: int("id").autoincrement().primaryKey(),
  benchmarkKey: varchar("benchmarkKey", { length: 255 }).notNull(),
  // category:tier:unit
  currentTypical: decimal("currentTypical", { precision: 12, scale: 2 }),
  currentMin: decimal("currentMin", { precision: 12, scale: 2 }),
  currentMax: decimal("currentMax", { precision: 12, scale: 2 }),
  proposedP25: decimal("proposedP25", { precision: 12, scale: 2 }).notNull(),
  proposedP50: decimal("proposedP50", { precision: 12, scale: 2 }).notNull(),
  proposedP75: decimal("proposedP75", { precision: 12, scale: 2 }).notNull(),
  weightedMean: decimal("weightedMean", { precision: 12, scale: 2 }).notNull(),
  deltaPct: decimal("deltaPct", { precision: 8, scale: 2 }),
  // % change from current
  evidenceCount: int("evidenceCount").notNull(),
  sourceDiversity: int("sourceDiversity").notNull(),
  reliabilityDist: json("reliabilityDist").notNull(),
  // { A: n, B: n, C: n }
  recencyDist: json("recencyDist").notNull(),
  // { recent: n, mid: n, old: n }
  confidenceScore: int("confidenceScore").notNull(),
  // 0-100
  impactNotes: text("impactNotes"),
  recommendation: mysqlEnum("recommendation", ["publish", "reject"]).notNull(),
  rejectionReason: text("rejectionReason"),
  // Review workflow
  status: mysqlEnum("status", ["pending", "approved", "rejected"]).default("pending").notNull(),
  reviewerNotes: text("reviewerNotes"),
  reviewedBy: int("reviewedBy"),
  reviewedAt: timestamp("reviewedAt"),
  // Snapshot linking
  benchmarkSnapshotId: int("benchmarkSnapshotId"),
  runId: varchar("runId", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var benchmarkSnapshots = mysqlTable("benchmark_snapshots", {
  id: int("id").autoincrement().primaryKey(),
  benchmarkVersionId: int("benchmarkVersionId"),
  snapshotJson: json("snapshotJson").notNull(),
  // full benchmark state at time of snapshot
  description: text("description"),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var competitorEntities = mysqlTable("competitor_entities", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  headquarters: varchar("headquarters", { length: 255 }),
  segmentFocus: mysqlEnum("segmentFocus", [
    "affordable",
    "mid",
    "premium",
    "luxury",
    "ultra_luxury",
    "mixed"
  ]).default("mixed"),
  website: text("website"),
  logoUrl: text("logoUrl"),
  notes: text("notes"),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var competitorProjects = mysqlTable("competitor_projects", {
  id: int("id").autoincrement().primaryKey(),
  competitorId: int("competitorId").notNull(),
  // FK to competitor_entities
  projectName: varchar("projectName", { length: 255 }).notNull(),
  location: varchar("location", { length: 255 }),
  segment: mysqlEnum("segment", [
    "affordable",
    "mid",
    "premium",
    "luxury",
    "ultra_luxury"
  ]),
  assetType: mysqlEnum("assetType", [
    "residential",
    "commercial",
    "hospitality",
    "mixed_use"
  ]).default("residential"),
  positioningKeywords: json("positioningKeywords"),
  // string[]
  interiorStyleSignals: json("interiorStyleSignals"),
  // string[]
  materialCues: json("materialCues"),
  // string[]
  amenityList: json("amenityList"),
  // string[]
  unitMix: text("unitMix"),
  priceIndicators: json("priceIndicators"),
  // { currency, min, max, per_unit }
  salesMessaging: json("salesMessaging"),
  // string[]
  differentiationClaims: json("differentiationClaims"),
  // string[]
  completionStatus: mysqlEnum("completionStatus", [
    "announced",
    "under_construction",
    "completed",
    "sold_out"
  ]),
  launchDate: varchar("launchDate", { length: 32 }),
  totalUnits: int("totalUnits"),
  architect: varchar("architect", { length: 255 }),
  interiorDesigner: varchar("interiorDesigner", { length: 255 }),
  sourceUrl: text("sourceUrl"),
  captureDate: timestamp("captureDate"),
  evidenceCitations: json("evidenceCitations"),
  // array of { field, snippet, source_url, capture_date }
  completenessScore: int("completenessScore"),
  // 0-100
  runId: varchar("runId", { length: 64 }),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var trendTags = mysqlTable("trend_tags", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 128 }).notNull().unique(),
  category: mysqlEnum("category", [
    "material_trend",
    "design_trend",
    "market_trend",
    "buyer_preference",
    "sustainability",
    "technology",
    "pricing",
    "other"
  ]).notNull(),
  description: text("description"),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var entityTags = mysqlTable("entity_tags", {
  id: int("id").autoincrement().primaryKey(),
  tagId: int("tagId").notNull(),
  // FK to trend_tags
  entityType: mysqlEnum("entityType", [
    "competitor_project",
    "scenario",
    "evidence_record",
    "project"
  ]).notNull(),
  entityId: int("entityId").notNull(),
  addedBy: int("addedBy"),
  addedAt: timestamp("addedAt").defaultNow().notNull()
});
var intelligenceAuditLog = mysqlTable("intelligence_audit_log", {
  id: int("id").autoincrement().primaryKey(),
  runType: mysqlEnum("runType", [
    "price_extraction",
    "competitor_extraction",
    "benchmark_proposal",
    "manual_entry"
  ]).notNull(),
  runId: varchar("runId", { length: 64 }).notNull().unique(),
  actor: int("actor"),
  // userId who triggered
  inputSummary: json("inputSummary"),
  // config/params used
  outputSummary: json("outputSummary"),
  // counts, coverage, errors
  sourcesProcessed: int("sourcesProcessed").default(0),
  recordsExtracted: int("recordsExtracted").default(0),
  errors: int("errors").default(0),
  errorDetails: json("errorDetails"),
  startedAt: timestamp("startedAt").notNull(),
  completedAt: timestamp("completedAt")
});
var evidenceReferences = mysqlTable("evidence_references", {
  id: int("id").autoincrement().primaryKey(),
  evidenceRecordId: int("evidenceRecordId").notNull(),
  // FK to evidence_records
  targetType: mysqlEnum("targetType", [
    "scenario",
    "decision_note",
    "explainability_driver",
    "design_brief",
    "report",
    "material_board",
    "pack_section"
  ]).notNull(),
  targetId: int("targetId").notNull(),
  // ID of the linked entity
  sectionLabel: varchar("sectionLabel", { length: 255 }),
  // e.g. "Materials Specification", "Cost Assumptions"
  citationText: text("citationText"),
  // inline citation snippet
  addedBy: int("addedBy"),
  addedAt: timestamp("addedAt").defaultNow().notNull()
});
var ingestionRuns = mysqlTable("ingestion_runs", {
  id: int("id").autoincrement().primaryKey(),
  runId: varchar("runId", { length: 64 }).notNull().unique(),
  trigger: mysqlEnum("trigger", ["manual", "scheduled", "api"]).notNull(),
  triggeredBy: int("triggeredBy"),
  // userId or null for scheduled
  status: mysqlEnum("status", ["running", "completed", "failed"]).default("running").notNull(),
  // Counts
  totalSources: int("totalSources").default(0).notNull(),
  sourcesSucceeded: int("sourcesSucceeded").default(0).notNull(),
  sourcesFailed: int("sourcesFailed").default(0).notNull(),
  recordsExtracted: int("recordsExtracted").default(0).notNull(),
  recordsInserted: int("recordsInserted").default(0).notNull(),
  duplicatesSkipped: int("duplicatesSkipped").default(0).notNull(),
  // Detail
  sourceBreakdown: json("sourceBreakdown"),
  // per-source { sourceId, name, status, extracted, inserted, duplicates, errors }
  errorSummary: json("errorSummary"),
  // [{ sourceId, error }]
  // Timing
  startedAt: timestamp("startedAt").notNull(),
  completedAt: timestamp("completedAt"),
  durationMs: int("durationMs"),
  // Metadata
  cronExpression: varchar("cronExpression", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var connectorHealth = mysqlTable("connector_health", {
  id: int("id").autoincrement().primaryKey(),
  runId: varchar("runId", { length: 64 }).notNull(),
  // FK to ingestion_runs.runId
  sourceId: varchar("sourceId", { length: 64 }).notNull(),
  sourceName: varchar("sourceName", { length: 255 }).notNull(),
  status: mysqlEnum("healthStatus", ["success", "partial", "failed"]).notNull(),
  httpStatusCode: int("httpStatusCode"),
  responseTimeMs: int("responseTimeMs"),
  recordsExtracted: int("recordsExtracted").default(0).notNull(),
  recordsInserted: int("recordsInserted").default(0).notNull(),
  duplicatesSkipped: int("duplicatesSkipped").default(0).notNull(),
  errorMessage: text("errorMessage"),
  errorType: varchar("errorType", { length: 64 }),
  // "dns_failure", "timeout", "http_error", "parse_error", "llm_error"
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var trendSnapshots = mysqlTable("trend_snapshots", {
  id: int("id").autoincrement().primaryKey(),
  metric: varchar("metric", { length: 255 }).notNull(),
  category: varchar("category", { length: 128 }).notNull(),
  geography: varchar("geography", { length: 128 }).notNull(),
  dataPointCount: int("dataPointCount").default(0).notNull(),
  gradeACount: int("gradeACount").default(0).notNull(),
  gradeBCount: int("gradeBCount").default(0).notNull(),
  gradeCCount: int("gradeCCount").default(0).notNull(),
  uniqueSources: int("uniqueSources").default(0).notNull(),
  dateRangeStart: timestamp("dateRangeStart"),
  dateRangeEnd: timestamp("dateRangeEnd"),
  currentMA: decimal("currentMA", { precision: 14, scale: 4 }),
  previousMA: decimal("previousMA", { precision: 14, scale: 4 }),
  percentChange: decimal("percentChange", { precision: 10, scale: 6 }),
  direction: mysqlEnum("direction", ["rising", "falling", "stable", "insufficient_data"]).notNull(),
  anomalyCount: int("anomalyCount").default(0).notNull(),
  anomalyDetails: json("anomalyDetails"),
  // AnomalyFlag[]
  confidence: mysqlEnum("trendConfidence", ["high", "medium", "low", "insufficient"]).notNull(),
  narrative: text("narrative"),
  movingAverages: json("movingAverages"),
  // MovingAveragePoint[]
  ingestionRunId: varchar("ingestionRunId", { length: 64 }),
  // FK to ingestion_runs.runId
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var projectInsights = mysqlTable("project_insights", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId"),
  // nullable for system-wide insights
  insightType: mysqlEnum("insightType", [
    "cost_pressure",
    "market_opportunity",
    "competitor_alert",
    "trend_signal",
    "positioning_gap"
  ]).notNull(),
  severity: mysqlEnum("insightSeverity", ["critical", "warning", "info"]).notNull(),
  title: varchar("title", { length: 512 }).notNull(),
  body: text("body"),
  actionableRecommendation: text("actionableRecommendation"),
  confidenceScore: decimal("confidenceScore", { precision: 5, scale: 4 }),
  triggerCondition: text("triggerCondition"),
  dataPoints: json("dataPoints"),
  status: mysqlEnum("insightStatus", ["active", "acknowledged", "dismissed", "resolved"]).default("active").notNull(),
  acknowledgedBy: int("acknowledgedBy"),
  acknowledgedAt: timestamp("acknowledgedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var priceChangeEvents = mysqlTable("price_change_events", {
  id: int("id").autoincrement().primaryKey(),
  itemName: varchar("itemName", { length: 255 }).notNull(),
  category: varchar("category", { length: 255 }).notNull(),
  sourceId: int("sourceId").notNull(),
  previousPrice: decimal("previousPrice", { precision: 12, scale: 2 }).notNull(),
  newPrice: decimal("newPrice", { precision: 12, scale: 2 }).notNull(),
  changePct: decimal("changePct", { precision: 10, scale: 6 }).notNull(),
  changeDirection: mysqlEnum("changeDirection", ["increased", "decreased"]).notNull(),
  severity: mysqlEnum("severity", ["significant", "notable", "minor", "none"]).notNull(),
  detectedAt: timestamp("detectedAt").defaultNow().notNull()
});
var platformAlerts = mysqlTable("platform_alerts", {
  id: int("id").autoincrement().primaryKey(),
  alertType: mysqlEnum("alertType", [
    "price_shock",
    "project_at_risk",
    "accuracy_degraded",
    "pattern_warning",
    "benchmark_drift",
    "market_opportunity"
  ]).notNull(),
  severity: mysqlEnum("severity", ["critical", "high", "medium", "info"]).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  body: text("body").notNull(),
  affectedProjectIds: json("affectedProjectIds"),
  affectedCategories: json("affectedCategories"),
  triggerData: json("triggerData"),
  suggestedAction: text("suggestedAction").notNull(),
  status: mysqlEnum("status", ["active", "acknowledged", "resolved", "expired"]).default("active").notNull(),
  acknowledgedBy: int("acknowledgedBy"),
  acknowledgedAt: timestamp("acknowledgedAt"),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var nlQueryLog = mysqlTable("nl_query_log", {
  id: int("id").primaryKey().autoincrement(),
  userId: int("user_id").notNull(),
  queryText: text("query_text").notNull(),
  sqlGenerated: text("sql_generated"),
  rowsReturned: int("rows_returned").default(0),
  executionMs: int("execution_ms"),
  status: mysqlEnum("status", ["success", "error", "blocked"]).default("success"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var materialLibrary = mysqlTable("material_library", {
  id: int("id").primaryKey().autoincrement(),
  category: mysqlEnum("category", [
    "flooring",
    "wall_paint",
    "wall_tile",
    "ceiling",
    "joinery",
    "sanitaryware",
    "fittings",
    "lighting",
    "hardware",
    "specialty"
  ]).notNull(),
  tier: mysqlEnum("tier", [
    "affordable",
    "mid",
    "premium",
    "ultra"
  ]).notNull(),
  style: mysqlEnum("style", [
    "modern",
    "contemporary",
    "classic",
    "minimalist",
    "arabesque",
    "all"
  ]).default("all").notNull(),
  productCode: varchar("product_code", { length: 100 }),
  productName: varchar("product_name", { length: 300 }).notNull(),
  brand: varchar("brand", { length: 150 }).notNull(),
  supplierName: varchar("supplier_name", { length: 200 }).notNull(),
  supplierLocation: varchar("supplier_location", { length: 200 }),
  supplierPhone: varchar("supplier_phone", { length: 50 }),
  unitLabel: varchar("unit_label", { length: 30 }).notNull(),
  priceAedMin: decimal("price_aed_min", { precision: 10, scale: 2 }),
  priceAedMax: decimal("price_aed_max", { precision: 10, scale: 2 }),
  notes: text("notes"),
  isActive: boolean("is_active").default(true).notNull()
});
var finishScheduleItems = mysqlTable(
  "finish_schedule_items",
  {
    id: int("id").primaryKey().autoincrement(),
    projectId: int("project_id").notNull(),
    organizationId: int("organization_id").notNull(),
    roomId: varchar("room_id", { length: 10 }).notNull(),
    roomName: varchar("room_name", { length: 100 }).notNull(),
    element: mysqlEnum("element", [
      "floor",
      "wall_primary",
      "wall_feature",
      "wall_wet",
      "ceiling",
      "joinery",
      "hardware"
    ]).notNull(),
    materialLibraryId: int("material_library_id"),
    overrideSpec: varchar("override_spec", { length: 500 }),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull()
  }
);
var projectColorPalettes = mysqlTable(
  "project_color_palettes",
  {
    id: int("id").primaryKey().autoincrement(),
    projectId: int("project_id").notNull(),
    organizationId: int("organization_id").notNull(),
    paletteKey: varchar("palette_key", { length: 100 }).notNull(),
    colors: json("colors").notNull(),
    geminiRationale: text("gemini_rationale"),
    createdAt: timestamp("created_at").defaultNow().notNull()
  }
);
var rfqLineItems = mysqlTable("rfq_line_items", {
  id: int("id").primaryKey().autoincrement(),
  projectId: int("project_id").notNull(),
  organizationId: int("organization_id").notNull(),
  sectionNo: int("section_no").notNull(),
  itemCode: varchar("item_code", { length: 20 }).notNull(),
  description: varchar("description", { length: 500 }).notNull(),
  unit: varchar("unit", { length: 20 }).notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 2 }),
  unitRateAedMin: decimal(
    "unit_rate_aed_min",
    { precision: 10, scale: 2 }
  ),
  unitRateAedMax: decimal(
    "unit_rate_aed_max",
    { precision: 10, scale: 2 }
  ),
  totalAedMin: decimal(
    "total_aed_min",
    { precision: 12, scale: 2 }
  ),
  totalAedMax: decimal(
    "total_aed_max",
    { precision: 12, scale: 2 }
  ),
  supplierName: varchar("supplier_name", { length: 200 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var dmComplianceChecklists = mysqlTable(
  "dm_compliance_checklists",
  {
    id: int("id").primaryKey().autoincrement(),
    projectId: int("project_id").notNull(),
    organizationId: int("organization_id").notNull(),
    items: json("items").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull()
  }
);
var projectRoiModels = mysqlTable("project_roi_models", {
  id: int("id").primaryKey().autoincrement(),
  projectId: int("project_id").notNull(),
  scenarioId: int("scenario_id"),
  reworkCostAvoided: decimal("rework_cost_avoided", { precision: 14, scale: 2 }).notNull(),
  programmeAccelerationValue: decimal("programme_acceleration_value", { precision: 14, scale: 2 }).notNull(),
  totalValueCreated: decimal("total_value_created", { precision: 14, scale: 2 }).notNull(),
  netRoiPercent: decimal("net_roi_percent", { precision: 8, scale: 2 }).notNull(),
  confidenceMultiplier: decimal("confidence_multiplier", { precision: 5, scale: 4 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var scenarioStressTests = mysqlTable("scenario_stress_tests", {
  id: int("id").primaryKey().autoincrement(),
  scenarioId: int("scenario_id").notNull(),
  stressCondition: varchar("stress_condition", { length: 100 }).notNull(),
  impactMagnitudePercent: decimal("impact_magnitude_percent", { precision: 6, scale: 2 }).notNull(),
  resilienceScore: int("resilience_score").notNull(),
  // 1-100
  failurePoints: json("failure_points").notNull(),
  // JSON array of components that fail
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var riskSurfaceMaps = mysqlTable("risk_surface_maps", {
  id: int("id").primaryKey().autoincrement(),
  projectId: int("project_id").notNull(),
  domain: varchar("domain", { length: 100 }).notNull(),
  probability: int("probability").notNull(),
  // 0-100
  impact: int("impact").notNull(),
  // 0-100
  vulnerability: int("vulnerability").notNull(),
  // 0-100
  controlStrength: int("control_strength").notNull(),
  // 1-100
  compositeRiskScore: int("composite_risk_score").notNull(),
  // Calculated via R = (P * I * V) / C
  riskBand: mysqlEnum("risk_band", ["Minimal", "Controlled", "Elevated", "Critical", "Systemic"]).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

// server/_core/env.ts
var ENV = {
  // Database
  DATABASE_URL: process.env.DATABASE_URL || "",
  // App / Auth
  cookieSecret: process.env.JWT_SECRET ?? "",
  isProduction: process.env.NODE_ENV === "production",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  // Google Maps (optional — used by map.ts for geocoding & directions)
  googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY ?? ""
};

// server/db.ts
var _db = null;
async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      const url = new URL(process.env.DATABASE_URL);
      console.log("[Database] Connecting to:", url.hostname, "database:", url.pathname.slice(1));
      const pool = mysql.createPool({
        host: url.hostname,
        port: url.port ? parseInt(url.port) : 3306,
        user: decodeURIComponent(url.username),
        password: decodeURIComponent(url.password),
        database: url.pathname.slice(1),
        ssl: { rejectUnauthorized: true },
        waitForConnections: true,
        connectionLimit: 5
      });
      _db = drizzle(pool);
      console.log("[Database] Connected successfully");
    } catch (error) {
      console.error("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  if (!_db) {
    console.warn("[Database] getDb() returning null. DATABASE_URL set:", !!process.env.DATABASE_URL);
  }
  return _db;
}
async function upsertUser(user) {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  const values = { openId: user.openId };
  const updateSet = {};
  const textFields = ["name", "email", "loginMethod"];
  const assignNullable = (field) => {
    const value = user[field];
    if (value === void 0) return;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  };
  textFields.forEach(assignNullable);
  if (user.password !== void 0) {
    values.password = user.password;
    updateSet.password = user.password;
  }
  if (user.lastSignedIn !== void 0) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== void 0) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  if (!values.lastSignedIn) values.lastSignedIn = /* @__PURE__ */ new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = /* @__PURE__ */ new Date();
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}
async function getUserByOpenId(openId) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : void 0;
}
async function getUserByEmail(email) {
  const db = await getDb();
  console.log("[Database] getUserByEmail called, db available:", !!db, "email:", email);
  if (!db) return void 0;
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  console.log("[Database] getUserByEmail query result count:", result.length);
  return result.length > 0 ? result[0] : void 0;
}
async function emailExists(email) {
  const db = await getDb();
  if (!db) return false;
  const result = await db.select({ count: sql`COUNT(*)` }).from(users).where(eq(users.email, email));
  return (result[0]?.count ?? 0) > 0;
}
async function createProject(data) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(projects).values(data);
  return { id: Number(result[0].insertId) };
}
async function getProjectsByUser(userId) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(projects).where(eq(projects.userId, userId)).orderBy(desc(projects.updatedAt));
}
async function getProjectsByOrg(orgId) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(projects).where(eq(projects.orgId, orgId)).orderBy(desc(projects.updatedAt));
}
async function getAllProjects() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(projects).orderBy(desc(projects.updatedAt));
}
async function getProjectById(id) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
  return result[0];
}
async function updateProject(id, data) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(projects).set(data).where(eq(projects.id, id));
}
async function deleteProject(id) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(projects).where(eq(projects.id, id));
}
async function createScoreMatrix(data) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(scoreMatrices).values(data);
  return { id: Number(result[0].insertId) };
}
async function getScoreMatricesByProject(projectId) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(scoreMatrices).where(eq(scoreMatrices.projectId, projectId)).orderBy(desc(scoreMatrices.computedAt));
}
async function getScoreMatrixById(id) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(scoreMatrices).where(eq(scoreMatrices.id, id)).limit(1);
  return result[0];
}
async function getAllScoreMatrices() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(scoreMatrices).orderBy(desc(scoreMatrices.computedAt));
}
async function createScenarioRecord(data) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(scenarios).values(data);
  return { id: Number(result[0].insertId) };
}
async function getScenariosByProject(projectId) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(scenarios).where(eq(scenarios.projectId, projectId));
}
async function deleteScenario(id) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(scenarios).where(eq(scenarios.id, id));
}
async function getActiveModelVersion() {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(modelVersions).where(eq(modelVersions.isActive, true)).limit(1);
  return result[0];
}
async function getAllModelVersions() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(modelVersions).orderBy(desc(modelVersions.createdAt));
}
async function createModelVersion(data) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(modelVersions).set({ isActive: false }).where(eq(modelVersions.isActive, true));
  const result = await db.insert(modelVersions).values({ ...data, isActive: true });
  return { id: Number(result[0].insertId) };
}
async function getBenchmarks(typology, location, marketTier) {
  const db = await getDb();
  if (!db) return [];
  let query = db.select().from(benchmarkData);
  const conditions = [];
  if (typology) conditions.push(eq(benchmarkData.typology, typology));
  if (location) conditions.push(eq(benchmarkData.location, location));
  if (marketTier) conditions.push(eq(benchmarkData.marketTier, marketTier));
  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }
  return query;
}
async function getExpectedCost(typology, location, marketTier) {
  const benchmarks = await getBenchmarks(typology, location, marketTier);
  if (benchmarks.length === 0) return 400;
  const avg = benchmarks.reduce((sum, b) => sum + Number(b.costPerSqftMid ?? 400), 0) / benchmarks.length;
  return avg;
}
async function createBenchmark(data) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(benchmarkData).values(data);
  return { id: Number(result[0].insertId) };
}
async function deleteBenchmark(id) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(benchmarkData).where(eq(benchmarkData.id, id));
}
async function getAllBenchmarkData() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(benchmarkData).orderBy(desc(benchmarkData.updatedAt));
}
async function getAllBenchmarkVersions() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(benchmarkVersions).orderBy(desc(benchmarkVersions.createdAt));
}
async function getActiveBenchmarkVersion() {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(benchmarkVersions).where(eq(benchmarkVersions.status, "published")).orderBy(desc(benchmarkVersions.publishedAt)).limit(1);
  return result[0];
}
async function createBenchmarkVersion(data) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(benchmarkVersions).values(data);
  return { id: Number(result[0].insertId) };
}
async function publishBenchmarkVersion(id, publishedBy) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(benchmarkVersions).set({ status: "archived" }).where(eq(benchmarkVersions.status, "published"));
  const count = await db.select({ count: sql`COUNT(*)` }).from(benchmarkData).where(eq(benchmarkData.benchmarkVersionId, id));
  await db.update(benchmarkVersions).set({
    status: "published",
    publishedAt: /* @__PURE__ */ new Date(),
    publishedBy,
    recordCount: count[0]?.count ?? 0
  }).where(eq(benchmarkVersions.id, id));
}
async function getBenchmarkDiff(oldVersionId, newVersionId) {
  const db = await getDb();
  if (!db) return { added: 0, removed: 0, changed: 0 };
  const oldData = await db.select().from(benchmarkData).where(eq(benchmarkData.benchmarkVersionId, oldVersionId));
  const newData = await db.select().from(benchmarkData).where(eq(benchmarkData.benchmarkVersionId, newVersionId));
  const oldKeys = new Set(oldData.map((d) => `${d.typology}-${d.location}-${d.marketTier}-${d.materialLevel}`));
  const newKeys = new Set(newData.map((d) => `${d.typology}-${d.location}-${d.marketTier}-${d.materialLevel}`));
  let added = 0, removed = 0, changed = 0;
  newKeys.forEach((k) => {
    if (!oldKeys.has(k)) added++;
  });
  oldKeys.forEach((k) => {
    if (!newKeys.has(k)) removed++;
  });
  const oldMap = new Map(oldData.map((d) => [`${d.typology}-${d.location}-${d.marketTier}-${d.materialLevel}`, d]));
  const newMap = new Map(newData.map((d) => [`${d.typology}-${d.location}-${d.marketTier}-${d.materialLevel}`, d]));
  oldKeys.forEach((k) => {
    if (newKeys.has(k)) {
      const o = oldMap.get(k);
      const n = newMap.get(k);
      if (o && n && Number(o.costPerSqftMid) !== Number(n.costPerSqftMid)) changed++;
    }
  });
  return { added, removed, changed };
}
async function getAllBenchmarkCategories(category, projectClass) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (category) conditions.push(eq(benchmarkCategories.category, category));
  if (projectClass) conditions.push(eq(benchmarkCategories.projectClass, projectClass));
  let query = db.select().from(benchmarkCategories);
  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }
  return query.orderBy(desc(benchmarkCategories.createdAt));
}
async function createBenchmarkCategory(data) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(benchmarkCategories).values(data);
  return { id: Number(result[0].insertId) };
}
async function updateBenchmarkCategory(id, data) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(benchmarkCategories).set(data).where(eq(benchmarkCategories.id, id));
}
async function deleteBenchmarkCategory(id) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(benchmarkCategories).where(eq(benchmarkCategories.id, id));
}
async function createProjectIntelligence(data) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(projectIntelligence).values(data);
  return { id: Number(result[0].insertId) };
}
async function getProjectIntelligenceByProject(projectId) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(projectIntelligence).where(eq(projectIntelligence.projectId, projectId)).orderBy(desc(projectIntelligence.computedAt));
}
async function getAllProjectIntelligence() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(projectIntelligence).orderBy(desc(projectIntelligence.computedAt));
}
async function getActiveRoiConfig() {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(roiConfigs).where(eq(roiConfigs.isActive, true)).limit(1);
  return result[0];
}
async function getAllRoiConfigs() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(roiConfigs).orderBy(desc(roiConfigs.createdAt));
}
async function createRoiConfig(data) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(roiConfigs).set({ isActive: false }).where(eq(roiConfigs.isActive, true));
  const result = await db.insert(roiConfigs).values({ ...data, isActive: true });
  return { id: Number(result[0].insertId) };
}
async function updateRoiConfig(id, data) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(roiConfigs).set(data).where(eq(roiConfigs.id, id));
}
async function getAllWebhookConfigs() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(webhookConfigs).orderBy(desc(webhookConfigs.createdAt));
}
async function getActiveWebhookConfigs(event) {
  const db = await getDb();
  if (!db) return [];
  const all = await db.select().from(webhookConfigs).where(eq(webhookConfigs.isActive, true));
  if (!event) return all;
  return all.filter((w) => {
    const events = w.events;
    return events && events.includes(event);
  });
}
async function createWebhookConfig(data) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(webhookConfigs).values(data);
  return { id: Number(result[0].insertId) };
}
async function updateWebhookConfig(id, data) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(webhookConfigs).set(data).where(eq(webhookConfigs.id, id));
}
async function deleteWebhookConfig(id) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(webhookConfigs).where(eq(webhookConfigs.id, id));
}
async function createReportInstance(data) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(reportInstances).values(data);
  return { id: Number(result[0].insertId) };
}
async function getReportsByProject(projectId) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(reportInstances).where(eq(reportInstances.projectId, projectId)).orderBy(desc(reportInstances.generatedAt));
}
async function createAuditLog(data) {
  try {
    const db = await getDb();
    if (!db) return;
    await db.insert(auditLogs).values(data);
  } catch (error) {
    console.error("[AuditLog] Failed to insert audit log:", error);
  }
}
async function getAuditLogs(limit = 50) {
  const db = await getDb();
  if (!db) return [];
  const results = await db.select({
    log: auditLogs,
    user: {
      email: users.email,
      name: users.name
    }
  }).from(auditLogs).leftJoin(users, eq(auditLogs.userId, users.id)).orderBy(desc(auditLogs.createdAt)).limit(limit);
  return results.map((r) => ({ ...r.log, user: r.user }));
}
async function createOverrideRecord(data) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(overrideRecords).values(data);
  return { id: Number(result[0].insertId) };
}
async function getOverridesByProject(projectId) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(overrideRecords).where(eq(overrideRecords.projectId, projectId)).orderBy(desc(overrideRecords.createdAt));
}
async function createProjectAsset(data) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(projectAssets).values(data);
  return { id: Number(result[0].insertId) };
}
async function getProjectAssets(projectId, category) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(projectAssets.projectId, projectId)];
  if (category) conditions.push(eq(projectAssets.category, category));
  return db.select().from(projectAssets).where(and(...conditions)).orderBy(desc(projectAssets.uploadedAt));
}
async function getProjectAssetById(id) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(projectAssets).where(eq(projectAssets.id, id));
  return result[0];
}
async function deleteProjectAsset(id) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(projectAssets).where(eq(projectAssets.id, id));
}
async function updateProjectAsset(id, data) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(projectAssets).set(data).where(eq(projectAssets.id, id));
}
async function createAssetLink(data) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(assetLinks).values(data);
  return { id: Number(result[0].insertId) };
}
async function getAssetLinksByAsset(assetId) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(assetLinks).where(eq(assetLinks.assetId, assetId));
}
async function createDesignBrief(data) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(designBriefs).values(data);
  return { id: Number(result[0].insertId) };
}
async function getDesignBriefsByProject(projectId) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(designBriefs).where(eq(designBriefs.projectId, projectId)).orderBy(desc(designBriefs.createdAt));
}
async function getDesignBriefById(id) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(designBriefs).where(eq(designBriefs.id, id));
  return result[0];
}
async function getLatestDesignBrief(projectId) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(designBriefs).where(eq(designBriefs.projectId, projectId)).orderBy(desc(designBriefs.version)).limit(1);
  return result[0];
}
async function createGeneratedVisual(data) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(generatedVisuals).values(data);
  return { id: Number(result[0].insertId) };
}
async function getGeneratedVisualsByProject(projectId) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(generatedVisuals).where(eq(generatedVisuals.projectId, projectId)).orderBy(desc(generatedVisuals.createdAt));
}
async function updateGeneratedVisual(id, data) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(generatedVisuals).set(data).where(eq(generatedVisuals.id, id));
}
async function getGeneratedVisualById(id) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(generatedVisuals).where(eq(generatedVisuals.id, id));
  return result[0];
}
async function createMaterialBoard(data) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(materialBoards).values(data);
  return { id: Number(result[0].insertId) };
}
async function getMaterialBoardsByProject(projectId) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(materialBoards).where(eq(materialBoards.projectId, projectId)).orderBy(desc(materialBoards.createdAt));
}
async function getMaterialBoardById(id) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(materialBoards).where(eq(materialBoards.id, id));
  return result[0];
}
async function deleteMaterialBoard(id) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(materialsToBoards).where(eq(materialsToBoards.boardId, id));
  await db.delete(materialBoards).where(eq(materialBoards.id, id));
}
async function getAllMaterials(category, tier) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(materialsCatalog.isActive, true)];
  if (category) conditions.push(eq(materialsCatalog.category, category));
  if (tier) conditions.push(eq(materialsCatalog.tier, tier));
  return db.select().from(materialsCatalog).where(and(...conditions)).orderBy(materialsCatalog.name);
}
async function getMaterialById(id) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(materialsCatalog).where(eq(materialsCatalog.id, id));
  return result[0];
}
async function createMaterial(data) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(materialsCatalog).values(data);
  return { id: Number(result[0].insertId) };
}
async function updateMaterial(id, data) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(materialsCatalog).set(data).where(eq(materialsCatalog.id, id));
}
async function deleteMaterial(id) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(materialsCatalog).set({ isActive: false }).where(eq(materialsCatalog.id, id));
}
async function addMaterialToBoard(data) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(materialsToBoards).values(data);
  return { id: Number(result[0].insertId) };
}
async function getMaterialsByBoard(boardId) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(materialsToBoards).where(eq(materialsToBoards.boardId, boardId)).orderBy(materialsToBoards.sortOrder);
}
async function removeMaterialFromBoard(id) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(materialsToBoards).where(eq(materialsToBoards.id, id));
}
async function updateBoardTile(id, data) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const updates = {};
  if (data.specNotes !== void 0) updates.specNotes = data.specNotes;
  if (data.costBandOverride !== void 0) updates.costBandOverride = data.costBandOverride;
  if (data.quantity !== void 0) updates.quantity = data.quantity;
  if (data.unitOfMeasure !== void 0) updates.unitOfMeasure = data.unitOfMeasure;
  if (data.notes !== void 0) updates.notes = data.notes;
  if (data.sortOrder !== void 0) updates.sortOrder = data.sortOrder;
  if (Object.keys(updates).length > 0) {
    await db.update(materialsToBoards).set(updates).where(eq(materialsToBoards.id, id));
  }
}
async function reorderBoardTiles(boardId, orderedIds) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  for (let i = 0; i < orderedIds.length; i++) {
    await db.update(materialsToBoards).set({ sortOrder: i }).where(eq(materialsToBoards.id, orderedIds[i]));
  }
}
async function getAllPromptTemplates(type, orgId) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (type) conditions.push(eq(promptTemplates.type, type));
  if (orgId) conditions.push(eq(promptTemplates.orgId, orgId));
  let query = db.select().from(promptTemplates);
  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }
  return query.orderBy(desc(promptTemplates.createdAt));
}
async function getActivePromptTemplate(type, orgId) {
  const db = await getDb();
  if (!db) return void 0;
  const conditions = [eq(promptTemplates.type, type), eq(promptTemplates.isActive, true)];
  if (orgId) conditions.push(eq(promptTemplates.orgId, orgId));
  let query = db.select().from(promptTemplates).where(and(...conditions)).limit(1);
  const result = await query;
  return result[0];
}
async function createPromptTemplate(data) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(promptTemplates).values(data);
  return { id: Number(result[0].insertId) };
}
async function updatePromptTemplate(id, data) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(promptTemplates).set(data).where(eq(promptTemplates.id, id));
}
async function createComment(data) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(comments).values(data);
  return { id: Number(result[0].insertId) };
}
async function getCommentsByEntity(projectId, entityType, entityId) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [
    eq(comments.projectId, projectId),
    eq(comments.entityType, entityType)
  ];
  if (entityId !== void 0) conditions.push(eq(comments.entityId, entityId));
  return db.select().from(comments).where(and(...conditions)).orderBy(desc(comments.createdAt));
}
async function getCommentsByProject(projectId) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(comments).where(eq(comments.projectId, projectId)).orderBy(desc(comments.createdAt));
}
async function updateProjectApprovalState(projectId, approvalState) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(projects).set({ approvalState }).where(eq(projects.id, projectId));
}
async function getPublishedLogicVersion() {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(logicVersions).where(eq(logicVersions.status, "published")).orderBy(desc(logicVersions.publishedAt)).limit(1);
  return rows[0] ?? null;
}
async function listLogicVersions() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(logicVersions).orderBy(desc(logicVersions.createdAt));
}
async function getLogicVersionById(id) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(logicVersions).where(eq(logicVersions.id, id));
  return rows[0] ?? null;
}
async function createLogicVersion(data) {
  const db = await getDb();
  if (!db) return 0;
  const [result] = await db.insert(logicVersions).values(data);
  return result.insertId;
}
async function publishLogicVersion(id) {
  const db = await getDb();
  if (!db) return;
  await db.update(logicVersions).set({ status: "archived" }).where(eq(logicVersions.status, "published"));
  await db.update(logicVersions).set({ status: "published", publishedAt: /* @__PURE__ */ new Date() }).where(eq(logicVersions.id, id));
}
async function archiveLogicVersion(id) {
  const db = await getDb();
  if (!db) return;
  await db.update(logicVersions).set({ status: "archived" }).where(eq(logicVersions.id, id));
}
async function getLogicWeights(logicVersionId) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(logicWeights).where(eq(logicWeights.logicVersionId, logicVersionId));
}
async function setLogicWeights(logicVersionId, weights) {
  const db = await getDb();
  if (!db) return;
  await db.delete(logicWeights).where(eq(logicWeights.logicVersionId, logicVersionId));
  if (weights.length > 0) {
    await db.insert(logicWeights).values(
      weights.map((w) => ({ logicVersionId, dimension: w.dimension, weight: w.weight }))
    );
  }
}
async function getLogicThresholds(logicVersionId) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(logicThresholds).where(eq(logicThresholds.logicVersionId, logicVersionId));
}
async function setLogicThresholds(logicVersionId, thresholds) {
  const db = await getDb();
  if (!db) return;
  await db.delete(logicThresholds).where(eq(logicThresholds.logicVersionId, logicVersionId));
  if (thresholds.length > 0) {
    await db.insert(logicThresholds).values(
      thresholds.map((t2) => ({ logicVersionId, ...t2 }))
    );
  }
}
async function getLogicChangeLog(logicVersionId) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(logicChangeLog).where(eq(logicChangeLog.logicVersionId, logicVersionId)).orderBy(desc(logicChangeLog.createdAt));
}
async function addLogicChangeLogEntry(data) {
  const db = await getDb();
  if (!db) return 0;
  const [result] = await db.insert(logicChangeLog).values(data);
  return result.insertId;
}
async function createScenarioInput(data) {
  const db = await getDb();
  if (!db) return 0;
  const [result] = await db.insert(scenarioInputs).values({
    scenarioId: data.scenarioId,
    jsonInput: data.jsonInput
  });
  return result.insertId;
}
async function getScenarioInput(scenarioId) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(scenarioInputs).where(eq(scenarioInputs.scenarioId, scenarioId)).orderBy(desc(scenarioInputs.createdAt)).limit(1);
  return rows[0] ?? null;
}
async function createScenarioOutput(data) {
  const db = await getDb();
  if (!db) return 0;
  const [result] = await db.insert(scenarioOutputs).values(data);
  return result.insertId;
}
async function getScenarioOutput(scenarioId) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(scenarioOutputs).where(eq(scenarioOutputs.scenarioId, scenarioId)).orderBy(desc(scenarioOutputs.computedAt)).limit(1);
  return rows[0] ?? null;
}
async function listScenarioOutputs(scenarioIds) {
  if (scenarioIds.length === 0) return [];
  const db = await getDb();
  if (!db) return [];
  return db.select().from(scenarioOutputs).where(inArray(scenarioOutputs.scenarioId, scenarioIds)).orderBy(desc(scenarioOutputs.computedAt));
}
async function createScenarioComparison(data) {
  const db = await getDb();
  if (!db) return 0;
  const [result] = await db.insert(scenarioComparisons).values(data);
  return result.insertId;
}
async function listScenarioComparisons(projectId) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(scenarioComparisons).where(eq(scenarioComparisons.projectId, projectId)).orderBy(desc(scenarioComparisons.createdAt));
}
async function getScenarioComparisonById(id) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(scenarioComparisons).where(eq(scenarioComparisons.id, id));
  return rows[0] ?? null;
}
async function createProjectOutcome(data) {
  const db = await getDb();
  if (!db) return 0;
  const [result] = await db.insert(projectOutcomes).values(data);
  return result.insertId;
}
async function getProjectOutcomes(projectId) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(projectOutcomes).where(eq(projectOutcomes.projectId, projectId)).orderBy(desc(projectOutcomes.capturedAt));
}
async function listAllOutcomes() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(projectOutcomes).orderBy(desc(projectOutcomes.capturedAt));
}
async function createBenchmarkSuggestion(data) {
  const db = await getDb();
  if (!db) return 0;
  const [result] = await db.insert(benchmarkSuggestions).values(data);
  return result.insertId;
}
async function listBenchmarkSuggestions() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(benchmarkSuggestions).orderBy(desc(benchmarkSuggestions.createdAt));
}
async function reviewBenchmarkSuggestion(id, data) {
  const db = await getDb();
  if (!db) return;
  await db.update(benchmarkSuggestions).set({ ...data, reviewedAt: /* @__PURE__ */ new Date() }).where(eq(benchmarkSuggestions.id, id));
}
async function listSourceRegistry() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(sourceRegistry).orderBy(desc(sourceRegistry.addedAt));
}
async function getSourceRegistryById(id) {
  const db = await getDb();
  if (!db) return void 0;
  const rows = await db.select().from(sourceRegistry).where(eq(sourceRegistry.id, id));
  return rows[0];
}
async function createSourceRegistryEntry(data) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db.insert(sourceRegistry).values(data);
  return { id: Number(result.insertId) };
}
async function updateSourceRegistryEntry(id, data) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(sourceRegistry).set(data).where(eq(sourceRegistry.id, id));
}
async function deleteSourceRegistryEntry(id) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(sourceRegistry).where(eq(sourceRegistry.id, id));
}
async function listEvidenceRecords(filters) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (filters?.projectId) conditions.push(eq(evidenceRecords.projectId, filters.projectId));
  if (filters?.category) conditions.push(eq(evidenceRecords.category, filters.category));
  if (filters?.reliabilityGrade) conditions.push(eq(evidenceRecords.reliabilityGrade, filters.reliabilityGrade));
  if (filters?.evidencePhase) conditions.push(eq(evidenceRecords.evidencePhase, filters.evidencePhase));
  if (filters?.confidentiality) conditions.push(eq(evidenceRecords.confidentiality, filters.confidentiality));
  if (filters?.excludeConfidential) {
    conditions.push(sql`${evidenceRecords.confidentiality} NOT IN ('confidential', 'restricted')`);
  }
  let query = db.select().from(evidenceRecords);
  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }
  return query.orderBy(desc(evidenceRecords.createdAt)).limit(filters?.limit ?? 100);
}
async function getEvidenceRecordById(id) {
  const db = await getDb();
  if (!db) return void 0;
  const rows = await db.select().from(evidenceRecords).where(eq(evidenceRecords.id, id));
  return rows[0];
}
async function createEvidenceRecord(data) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db.insert(evidenceRecords).values(data);
  return { id: Number(result.insertId) };
}
async function deleteEvidenceRecord(id) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(evidenceRecords).where(eq(evidenceRecords.id, id));
}
async function getPreviousEvidenceRecord(itemName, sourceRegistryId, beforeDate) {
  const db = await getDb();
  if (!db) return void 0;
  const query = db.select().from(evidenceRecords).where(
    and(
      eq(evidenceRecords.itemName, itemName),
      eq(evidenceRecords.sourceRegistryId, sourceRegistryId),
      sql`${evidenceRecords.captureDate} < ${beforeDate}`
    )
  ).orderBy(desc(evidenceRecords.captureDate)).limit(1);
  const rows = await query;
  return rows[0];
}
async function createPriceChangeEvent(data) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db.insert(priceChangeEvents).values(data);
  return { id: Number(result.insertId) };
}
async function getEvidenceStats() {
  const db = await getDb();
  if (!db) return { total: 0, byCategory: {}, byGrade: {}, avgConfidence: 0 };
  const all = await db.select().from(evidenceRecords);
  const byCategory = {};
  const byGrade = {};
  let totalConfidence = 0;
  for (const rec of all) {
    byCategory[rec.category] = (byCategory[rec.category] ?? 0) + 1;
    byGrade[rec.reliabilityGrade] = (byGrade[rec.reliabilityGrade] ?? 0) + 1;
    totalConfidence += rec.confidenceScore;
  }
  return {
    total: all.length,
    byCategory,
    byGrade,
    avgConfidence: all.length > 0 ? Math.round(totalConfidence / all.length) : 0
  };
}
async function getDataHealthStats() {
  const db = await getDb();
  if (!db) return null;
  const allSources = await db.select().from(sourceRegistry);
  const activeSources = allSources.filter((s) => s.isActive);
  const failingSources = activeSources.filter((s) => s.consecutiveFailures > 0);
  const disabledSources = activeSources.filter((s) => s.consecutiveFailures >= 5);
  const sourceHealth = {
    total: allSources.length,
    active: activeSources.length,
    failing: failingSources.length,
    disabled: disabledSources.length
  };
  const allEvidence = await db.select().from(evidenceRecords);
  const categoryStats = {};
  const now = (/* @__PURE__ */ new Date()).getTime();
  for (const rec of allEvidence) {
    if (!categoryStats[rec.category]) {
      categoryStats[rec.category] = { count: 0, latestCapture: null, avgAgeDays: 0 };
    }
    const stat = categoryStats[rec.category];
    stat.count++;
    if (rec.captureDate) {
      if (!stat.latestCapture || rec.captureDate > stat.latestCapture) {
        stat.latestCapture = rec.captureDate;
      }
      const ageDays = (now - rec.captureDate.getTime()) / (1e3 * 60 * 60 * 24);
      stat.avgAgeDays += ageDays;
    }
  }
  const coverageGaps = [];
  for (const cat of Object.keys(categoryStats)) {
    const stat = categoryStats[cat];
    if (stat.count > 0) stat.avgAgeDays /= stat.count;
    if (stat.count < 10 || stat.avgAgeDays > 30) {
      coverageGaps.push({
        category: cat,
        count: stat.count,
        avgAgeDays: Math.round(stat.avgAgeDays)
      });
    }
  }
  const recentPriceChanges = await db.select().from(priceChangeEvents).orderBy(desc(priceChangeEvents.detectedAt)).limit(20);
  return {
    sourceHealth,
    categoryStats,
    coverageGaps,
    recentPriceChanges
  };
}
async function listBenchmarkProposals(status) {
  const db = await getDb();
  if (!db) return [];
  if (status) {
    return db.select().from(benchmarkProposals).where(eq(benchmarkProposals.status, status)).orderBy(desc(benchmarkProposals.createdAt));
  }
  return db.select().from(benchmarkProposals).orderBy(desc(benchmarkProposals.createdAt));
}
async function getBenchmarkProposalById(id) {
  const db = await getDb();
  if (!db) return void 0;
  const rows = await db.select().from(benchmarkProposals).where(eq(benchmarkProposals.id, id));
  return rows[0];
}
async function createBenchmarkProposal(data) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db.insert(benchmarkProposals).values(data);
  return { id: Number(result.insertId) };
}
async function reviewBenchmarkProposal(id, data) {
  const db = await getDb();
  if (!db) return;
  await db.update(benchmarkProposals).set({ ...data, reviewedAt: /* @__PURE__ */ new Date() }).where(eq(benchmarkProposals.id, id));
}
async function listBenchmarkSnapshots() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(benchmarkSnapshots).orderBy(desc(benchmarkSnapshots.createdAt));
}
async function getBenchmarkSnapshotById(id) {
  const db = await getDb();
  if (!db) return void 0;
  const rows = await db.select().from(benchmarkSnapshots).where(eq(benchmarkSnapshots.id, id));
  return rows[0];
}
async function createBenchmarkSnapshot(data) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db.insert(benchmarkSnapshots).values(data);
  return { id: Number(result.insertId) };
}
async function listCompetitorEntities() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(competitorEntities).orderBy(desc(competitorEntities.createdAt));
}
async function getCompetitorEntityById(id) {
  const db = await getDb();
  if (!db) return void 0;
  const rows = await db.select().from(competitorEntities).where(eq(competitorEntities.id, id));
  return rows[0];
}
async function createCompetitorEntity(data) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db.insert(competitorEntities).values(data);
  return { id: Number(result.insertId) };
}
async function updateCompetitorEntity(id, data) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(competitorEntities).set(data).where(eq(competitorEntities.id, id));
}
async function deleteCompetitorEntity(id) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(competitorProjects).where(eq(competitorProjects.competitorId, id));
  await db.delete(competitorEntities).where(eq(competitorEntities.id, id));
}
async function listCompetitorProjects(competitorId, segment) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (competitorId) conditions.push(eq(competitorProjects.competitorId, competitorId));
  if (segment) conditions.push(eq(competitorProjects.segment, segment));
  let query = db.select().from(competitorProjects);
  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }
  return query.orderBy(desc(competitorProjects.createdAt));
}
async function getCompetitorProjectById(id) {
  const db = await getDb();
  if (!db) return void 0;
  const rows = await db.select().from(competitorProjects).where(eq(competitorProjects.id, id));
  return rows[0];
}
async function createCompetitorProject(data) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db.insert(competitorProjects).values(data);
  return { id: Number(result.insertId) };
}
async function updateCompetitorProject(id, data) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(competitorProjects).set(data).where(eq(competitorProjects.id, id));
}
async function deleteCompetitorProject(id) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(competitorProjects).where(eq(competitorProjects.id, id));
}
async function listTrendTags(category) {
  const db = await getDb();
  if (!db) return [];
  if (category) {
    return db.select().from(trendTags).where(eq(trendTags.category, category)).orderBy(trendTags.name);
  }
  return db.select().from(trendTags).orderBy(trendTags.name);
}
async function createTrendTag(data) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db.insert(trendTags).values(data);
  return { id: Number(result.insertId) };
}
async function deleteTrendTag(id) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(entityTags).where(eq(entityTags.tagId, id));
  await db.delete(trendTags).where(eq(trendTags.id, id));
}
async function createEntityTag(data) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db.insert(entityTags).values(data);
  return { id: Number(result.insertId) };
}
async function deleteEntityTag(id) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(entityTags).where(eq(entityTags.id, id));
}
async function getEntityTags(entityType, entityId) {
  const db = await getDb();
  if (!db) return [];
  const tags = await db.select().from(entityTags).where(and(eq(entityTags.entityType, entityType), eq(entityTags.entityId, entityId)));
  if (tags.length === 0) return [];
  const tagIds = tags.map((t2) => t2.tagId);
  const tagDetails = await db.select().from(trendTags).where(inArray(trendTags.id, tagIds));
  const tagMap = new Map(tagDetails.map((t2) => [t2.id, t2]));
  return tags.map((t2) => ({
    ...t2,
    tag: tagMap.get(t2.tagId)
  }));
}
async function getTaggedEntities(tagId) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(entityTags).where(eq(entityTags.tagId, tagId));
}
async function createIntelligenceAuditEntry(data) {
  const db = await getDb();
  if (!db) return;
  await db.insert(intelligenceAuditLog).values(data);
}
async function listIntelligenceAuditLog(runType, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  if (runType) {
    return db.select().from(intelligenceAuditLog).where(eq(intelligenceAuditLog.runType, runType)).orderBy(desc(intelligenceAuditLog.startedAt)).limit(limit);
  }
  return db.select().from(intelligenceAuditLog).orderBy(desc(intelligenceAuditLog.startedAt)).limit(limit);
}
async function getIntelligenceAuditEntryById(id) {
  const db = await getDb();
  if (!db) return void 0;
  const rows = await db.select().from(intelligenceAuditLog).where(eq(intelligenceAuditLog.id, id));
  return rows[0];
}
async function listEvidenceReferences(filters) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (filters?.evidenceRecordId) conditions.push(eq(evidenceReferences.evidenceRecordId, filters.evidenceRecordId));
  if (filters?.targetType) conditions.push(eq(evidenceReferences.targetType, filters.targetType));
  if (filters?.targetId) conditions.push(eq(evidenceReferences.targetId, filters.targetId));
  let query = db.select().from(evidenceReferences);
  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }
  return query.orderBy(desc(evidenceReferences.addedAt));
}
async function createEvidenceReference(data) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db.insert(evidenceReferences).values(data);
  return { id: Number(result.insertId) };
}
async function deleteEvidenceReference(id) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(evidenceReferences).where(eq(evidenceReferences.id, id));
}
async function getEvidenceForTarget(targetType, targetId) {
  const db = await getDb();
  if (!db) return [];
  const refs = await db.select().from(evidenceReferences).where(and(
    eq(evidenceReferences.targetType, targetType),
    eq(evidenceReferences.targetId, targetId)
  ));
  if (refs.length === 0) return [];
  const recordIds = refs.map((r) => r.evidenceRecordId);
  const records = await db.select().from(evidenceRecords).where(inArray(evidenceRecords.id, recordIds));
  const recordMap = new Map(records.map((r) => [r.id, r]));
  return refs.map((ref) => ({
    reference: ref,
    evidence: recordMap.get(ref.evidenceRecordId)
  }));
}
async function insertConnectorHealth(data) {
  const db = await getDb();
  if (!db) return;
  await db.insert(connectorHealth).values(data);
}
async function getConnectorHealthByRun(runId) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(connectorHealth).where(eq(connectorHealth.runId, runId)).orderBy(connectorHealth.sourceId);
}
async function getConnectorHealthHistory(sourceId, limit = 30) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(connectorHealth).where(eq(connectorHealth.sourceId, sourceId)).orderBy(desc(connectorHealth.createdAt)).limit(limit);
}
async function getConnectorHealthSummary() {
  const db = await getDb();
  if (!db) return [];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1e3);
  return db.select().from(connectorHealth).where(gte(connectorHealth.createdAt, thirtyDaysAgo)).orderBy(desc(connectorHealth.createdAt));
}
async function insertTrendSnapshot(data) {
  const db = await getDb();
  if (!db) return;
  const result = await db.insert(trendSnapshots).values(data);
  return result;
}
async function getTrendSnapshots(filters) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (filters?.category) conditions.push(eq(trendSnapshots.category, filters.category));
  if (filters?.geography) conditions.push(eq(trendSnapshots.geography, filters.geography));
  if (filters?.direction) conditions.push(eq(trendSnapshots.direction, filters.direction));
  if (filters?.confidence) conditions.push(eq(trendSnapshots.confidence, filters.confidence));
  const query = db.select().from(trendSnapshots);
  if (conditions.length > 0) {
    return query.where(and(...conditions)).orderBy(desc(trendSnapshots.createdAt)).limit(filters?.limit ?? 50);
  }
  return query.orderBy(desc(trendSnapshots.createdAt)).limit(filters?.limit ?? 50);
}
async function getTrendHistory(metric, geography, limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(trendSnapshots).where(and(
    eq(trendSnapshots.metric, metric),
    eq(trendSnapshots.geography, geography)
  )).orderBy(desc(trendSnapshots.createdAt)).limit(limit);
}
async function getAnomalies(limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(trendSnapshots).where(sql`${trendSnapshots.anomalyCount} > 0`).orderBy(desc(trendSnapshots.createdAt)).limit(limit);
}
async function insertProjectInsight(data) {
  const db = await getDb();
  if (!db) return;
  return db.insert(projectInsights).values(data);
}
async function getProjectInsights(filters) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (filters?.projectId) conditions.push(eq(projectInsights.projectId, filters.projectId));
  if (filters?.insightType) conditions.push(eq(projectInsights.insightType, filters.insightType));
  if (filters?.severity) conditions.push(eq(projectInsights.severity, filters.severity));
  if (filters?.status) conditions.push(eq(projectInsights.status, filters.status));
  const query = db.select().from(projectInsights);
  if (conditions.length > 0) {
    return query.where(and(...conditions)).orderBy(desc(projectInsights.createdAt)).limit(filters?.limit ?? 50);
  }
  return query.orderBy(desc(projectInsights.createdAt)).limit(filters?.limit ?? 50);
}
async function updateInsightStatus(insightId, status, userId) {
  const db = await getDb();
  if (!db) return;
  const updates = { status };
  if (status === "acknowledged" && userId) {
    updates.acknowledgedBy = userId;
    updates.acknowledgedAt = /* @__PURE__ */ new Date();
  }
  return db.update(projectInsights).set(updates).where(eq(projectInsights.id, insightId));
}
async function insertFinishScheduleItem(data) {
  const db = await getDb();
  if (!db) return;
  return db.insert(finishScheduleItems).values(data);
}
async function insertProjectColorPalette(data) {
  const db = await getDb();
  if (!db) return;
  return db.insert(projectColorPalettes).values(data);
}
async function insertRfqLineItem(data) {
  const db = await getDb();
  if (!db) return;
  return db.insert(rfqLineItems).values(data);
}
async function insertDmComplianceChecklist(data) {
  const db = await getDb();
  if (!db) return;
  return db.insert(dmComplianceChecklists).values(data);
}

// shared/_core/errors.ts
var HttpError = class extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.name = "HttpError";
  }
};
var ForbiddenError = (msg) => new HttpError(403, msg);

// server/_core/sdk.ts
import { parse as parseCookieHeader } from "cookie";
import { SignJWT, jwtVerify } from "jose";
var isNonEmptyString2 = (value) => typeof value === "string" && value.length > 0;
var SDKServer = class {
  parseCookies(cookieHeader) {
    if (!cookieHeader) {
      return /* @__PURE__ */ new Map();
    }
    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }
  getSessionSecret() {
    const secret = ENV.cookieSecret;
    return new TextEncoder().encode(secret);
  }
  /**
   * Create a session token for a user openId
   */
  async createSessionToken(openId, options = {}) {
    return this.signSession(
      {
        openId,
        appId: "miyar-v2",
        name: options.name || ""
      },
      options
    );
  }
  async signSession(payload, options = {}) {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1e3);
    const secretKey = this.getSessionSecret();
    return new SignJWT({
      openId: payload.openId,
      appId: payload.appId,
      name: payload.name
    }).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setExpirationTime(expirationSeconds).sign(secretKey);
  }
  async verifySession(cookieValue) {
    if (!cookieValue) {
      console.warn("[Auth] Missing session cookie");
      return null;
    }
    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"]
      });
      const { openId, appId, name } = payload;
      if (!isNonEmptyString2(openId) || !isNonEmptyString2(appId) || !isNonEmptyString2(name)) {
        console.warn("[Auth] Session payload missing required fields");
        return null;
      }
      return {
        openId,
        appId,
        name
      };
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
      return null;
    }
  }
  async authenticateRequest(req) {
    const cookies = this.parseCookies(req.headers.cookie);
    const sessionCookie = cookies.get(COOKIE_NAME);
    const session = await this.verifySession(sessionCookie);
    if (!session) {
      throw ForbiddenError("Invalid session cookie");
    }
    const user = await getUserByOpenId(session.openId);
    if (!user) {
      throw ForbiddenError("User not found");
    }
    await upsertUser({
      openId: user.openId,
      lastSignedIn: /* @__PURE__ */ new Date()
    });
    return user;
  }
};
var sdk = new SDKServer();

// server/routers/auth.ts
import crypto from "crypto";
import bcryptjs from "bcryptjs";

// server/_core/cookies.ts
function isSecureRequest(req) {
  if (req.protocol === "https") return true;
  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;
  const protoList = Array.isArray(forwardedProto) ? forwardedProto : forwardedProto.split(",");
  return protoList.some((proto) => proto.trim().toLowerCase() === "https");
}
function getSessionCookieOptions(req) {
  const secure = isSecureRequest(req);
  return {
    domain: void 0,
    httpOnly: true,
    path: "/",
    sameSite: secure ? "none" : "lax",
    secure
  };
}

// server/routers/auth.ts
import { TRPCError as TRPCError3 } from "@trpc/server";

// server/_core/audit.ts
async function auditLog(data) {
  try {
    const db = await getDb();
    if (!db) return;
    await db.insert(auditLogs).values(data);
  } catch (error) {
    console.error("[AuditLog] Failed to insert audit log:", error);
  }
}

// server/routers/auth.ts
import { eq as eq2 } from "drizzle-orm";
var authRouter = router({
  me: publicProcedure.query((opts) => opts.ctx.user),
  logout: publicProcedure.mutation(async ({ ctx }) => {
    if (ctx.user) {
      await auditLog({
        userId: ctx.user.id,
        action: "auth.logout",
        entityType: "user",
        entityId: ctx.user.id,
        ipAddress: ctx.req?.headers?.["x-forwarded-for"] || ctx.req?.socket?.remoteAddress || "127.0.0.1"
      });
    }
    const cookieOptions = getSessionCookieOptions(ctx.req);
    ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    return { success: true };
  }),
  login: publicProcedure.input(z2.object({ email: z2.string().email(), password: z2.string() })).mutation(async ({ input, ctx }) => {
    console.log("[Auth] Login attempt for:", input.email);
    const user = await getUserByEmail(input.email);
    console.log("[Auth] getUserByEmail result:", user ? `found (id=${user.id}, email=${user.email})` : "NOT FOUND");
    if (!user) {
      throw new TRPCError3({
        code: "UNAUTHORIZED",
        message: "User not found or incorrect credentials"
      });
    }
    if (user.password) {
      const isValid = await bcryptjs.compare(input.password, user.password);
      if (!isValid) {
        const legacyHash = crypto.createHash("sha256").update(input.password).digest("hex");
        if (legacyHash === user.password) {
          console.log(`[Auth] Upgrading legacy SHA256 hash to bcrypt for user ${user.id}`);
          const newBcryptHash = await bcryptjs.hash(input.password, 12);
          await upsertUser({ ...user, password: newBcryptHash });
        } else {
          throw new TRPCError3({
            code: "UNAUTHORIZED",
            message: "User not found or incorrect credentials"
          });
        }
      }
    } else {
      throw new TRPCError3({
        code: "UNAUTHORIZED",
        message: "Please reset your password or sign in with your old method"
      });
    }
    const sessionToken = await sdk.createSessionToken(user.openId, {
      name: user.name || "",
      expiresInMs: ONE_YEAR_MS
    });
    const cookieOptions = getSessionCookieOptions(ctx.req);
    ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
    if (!user.orgId) {
      const drizzleDb = await getDb();
      if (drizzleDb) {
        const orgName = `${user.name || user.email?.split("@")[0] || "user"}'s Workspace`;
        const orgSlug = `${(user.name || user.email?.split("@")[0] || "user").toLowerCase().replace(/[^a-z0-9]/g, "-")}-${Date.now()}`;
        const [orgResult] = await drizzleDb.insert(organizations).values({
          name: orgName,
          slug: orgSlug,
          plan: "free"
        });
        const orgId = Number(orgResult.insertId);
        await drizzleDb.insert(organizationMembers).values({
          orgId,
          userId: user.id,
          role: "admin"
        });
        await drizzleDb.update(users).set({ orgId }).where(eq2(users.id, user.id));
      }
    }
    await auditLog({
      userId: user.id,
      action: "auth.login",
      entityType: "user",
      entityId: user.id,
      ipAddress: ctx.req?.headers?.["x-forwarded-for"] || ctx.req?.socket?.remoteAddress || "127.0.0.1"
    });
    return { success: true };
  }),
  register: publicProcedure.input(z2.object({ email: z2.string().email(), password: z2.string() })).mutation(async ({ input, ctx }) => {
    const exists = await emailExists(input.email);
    if (exists) {
      throw new TRPCError3({
        code: "CONFLICT",
        message: "Email already exists"
      });
    }
    const hash = await bcryptjs.hash(input.password, 12);
    const openId = crypto.randomUUID();
    await upsertUser({
      openId,
      name: input.email.split("@")[0],
      email: input.email,
      loginMethod: "local",
      lastSignedIn: /* @__PURE__ */ new Date(),
      password: hash
    });
    const sessionToken = await sdk.createSessionToken(openId, {
      name: input.email.split("@")[0],
      expiresInMs: ONE_YEAR_MS
    });
    const cookieOptions = getSessionCookieOptions(ctx.req);
    ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
    const createdUser = await getUserByEmail(input.email);
    if (createdUser) {
      const drizzleDb = await getDb();
      if (drizzleDb && !createdUser.orgId) {
        const orgName = `${input.email.split("@")[0]}'s Workspace`;
        const orgSlug = `${input.email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "-")}-${Date.now()}`;
        const [orgResult] = await drizzleDb.insert(organizations).values({
          name: orgName,
          slug: orgSlug,
          plan: "free"
        });
        const orgId = Number(orgResult.insertId);
        await drizzleDb.insert(organizationMembers).values({
          orgId,
          userId: createdUser.id,
          role: "admin"
        });
        await drizzleDb.update(users).set({ orgId }).where(eq2(users.id, createdUser.id));
      }
      await auditLog({
        userId: createdUser.id,
        action: "auth.register",
        entityType: "user",
        entityId: createdUser.id,
        ipAddress: ctx.req?.headers?.["x-forwarded-for"] || ctx.req?.socket?.remoteAddress || "127.0.0.1"
      });
    }
    return { success: true };
  })
});

// server/routers/project.ts
import { z as z3 } from "zod";

// server/engines/normalization.ts
function normalizeOrdinal(value) {
  return Math.max(0, Math.min(1, (value - 1) / 4));
}
function deriveScaleBand(gfa) {
  if (!gfa || gfa < 25e4) return "Small";
  if (gfa <= 8e5) return "Medium";
  return "Large";
}
function deriveBudgetClass(budgetCap) {
  if (!budgetCap || budgetCap < 200) return "Low";
  if (budgetCap <= 450) return "Mid";
  if (budgetCap <= 800) return "High";
  return "Premium";
}
function computeBudgetFit(budgetCap, expectedCost) {
  if (!budgetCap || expectedCost <= 0) return 0.5;
  return Math.max(0, Math.min(1, 1 - Math.abs(budgetCap - expectedCost) / expectedCost));
}
function computeCompatVisionMarket(str01, mkt01Tier) {
  const tierMap = {
    Mid: 2,
    "Upper-mid": 3,
    Luxury: 4,
    "Ultra-luxury": 5
  };
  const expectedTier = tierMap[mkt01Tier] || 3;
  const diff = Math.abs(str01 - expectedTier);
  if (diff === 0) return 1;
  if (diff === 1) return 0.6;
  return 0.2;
}
function computeCompatVisionDesign(str02, des01Style) {
  const styleAmbition = {
    Modern: 3,
    Contemporary: 3,
    Minimal: 2,
    Classic: 2,
    Fusion: 5,
    Other: 1
  };
  const styleLevel = styleAmbition[des01Style] || 3;
  const diff = Math.abs(str02 - styleLevel);
  if (diff <= 1) return 1;
  if (diff <= 2) return 0.5;
  return 0.1;
}
function computeMarketFit(ctx04Location, mkt01Tier, des02MaterialLevel) {
  const tierExpectedMaterial = {
    Mid: 2,
    "Upper-mid": 3,
    Luxury: 4,
    "Ultra-luxury": 5
  };
  const expected = tierExpectedMaterial[mkt01Tier] || 3;
  const diff = Math.abs(des02MaterialLevel - expected);
  const locationBonus = ctx04Location === "Prime" ? 0.1 : ctx04Location === "Secondary" ? 0 : -0.05;
  return Math.max(0, Math.min(1, 1 - diff * 0.2 + locationBonus));
}
function computeTrendFit(des01Style, mkt03Trend) {
  const trendAlignment = {
    Modern: 0.8,
    Contemporary: 0.9,
    Minimal: 0.7,
    Classic: 0.4,
    Fusion: 0.85,
    Other: 0.3
  };
  const baseAlignment = trendAlignment[des01Style] || 0.5;
  const trendSensitivity = normalizeOrdinal(mkt03Trend);
  return Math.max(0, Math.min(1, baseAlignment * (0.5 + 0.5 * trendSensitivity)));
}
function normalizeInputs(inputs, expectedCost) {
  const str01_n = normalizeOrdinal(inputs.str01BrandClarity);
  const str02_n = normalizeOrdinal(inputs.str02Differentiation);
  const str03_n = normalizeOrdinal(inputs.str03BuyerMaturity);
  const mkt02_n = normalizeOrdinal(inputs.mkt02Competitor);
  const mkt03_n = normalizeOrdinal(inputs.mkt03Trend);
  const fin02_n = normalizeOrdinal(inputs.fin02Flexibility);
  const fin03_n = normalizeOrdinal(inputs.fin03ShockTolerance);
  const fin04_n = normalizeOrdinal(inputs.fin04SalesPremium);
  const des02_n = normalizeOrdinal(inputs.des02MaterialLevel);
  const des03_n = normalizeOrdinal(inputs.des03Complexity);
  const des04_n = normalizeOrdinal(inputs.des04Experience);
  const des05_n = normalizeOrdinal(inputs.des05Sustainability);
  const exe01_n = normalizeOrdinal(inputs.exe01SupplyChain);
  const exe02_n = normalizeOrdinal(inputs.exe02Contractor);
  const exe03_n = normalizeOrdinal(inputs.exe03Approvals);
  const exe04_n = normalizeOrdinal(inputs.exe04QaMaturity);
  const executionResilience = (exe02_n + exe04_n) / 2;
  const differentiationPressure = (mkt02_n + str02_n) / 2;
  const budgetFit = computeBudgetFit(inputs.fin01BudgetCap, expectedCost);
  const costVolatility = (1 - exe01_n) * 0.5 + (1 - fin03_n) * 0.5;
  return {
    str01_n,
    str02_n,
    str03_n,
    mkt02_n,
    mkt03_n,
    fin02_n,
    fin03_n,
    fin04_n,
    des02_n,
    des03_n,
    des04_n,
    des05_n,
    exe01_n,
    exe02_n,
    exe03_n,
    exe04_n,
    scaleBand: deriveScaleBand(inputs.ctx03Gfa),
    budgetClass: deriveBudgetClass(inputs.fin01BudgetCap),
    differentiationPressure,
    executionResilience,
    budgetFit,
    marketFit: computeMarketFit(inputs.ctx04Location, inputs.mkt01Tier, inputs.des02MaterialLevel),
    trendFit: computeTrendFit(inputs.des01Style, inputs.mkt03Trend),
    compatVisionMarket: computeCompatVisionMarket(inputs.str01BrandClarity, inputs.mkt01Tier),
    compatVisionDesign: computeCompatVisionDesign(inputs.str02Differentiation, inputs.des01Style),
    costVolatility
  };
}

// server/engines/scoring.ts
function computeStrategicAlignment(n, w) {
  const raw = (w.str01 ?? 0.35) * n.str01_n + (w.str03 ?? 0.25) * n.str03_n + (w.compatVisionMarket ?? 0.25) * n.compatVisionMarket + (w.compatVisionDesign ?? 0.15) * n.compatVisionDesign;
  return Math.max(0, Math.min(100, raw * 100));
}
function computeFinancialFeasibility(n, w) {
  const raw = (w.budgetFit ?? 0.45) * n.budgetFit + (w.fin02 ?? 0.2) * n.fin02_n + (w.executionResilience ?? 0.2) * n.executionResilience + (w.costStability ?? 0.15) * (1 - n.costVolatility);
  return Math.max(0, Math.min(100, raw * 100));
}
function computeMarketPositioning(n, w) {
  const raw = (w.marketFit ?? 0.35) * n.marketFit + (w.differentiationPressure ?? 0.25) * n.differentiationPressure + (w.des04 ?? 0.2) * n.des04_n + (w.trendFit ?? 0.2) * n.trendFit;
  return Math.max(0, Math.min(100, raw * 100));
}
function computeDifferentiationStrength(n, w) {
  const raw = (w.str02 ?? 0.3) * n.str02_n + (w.competitorInverse ?? 0.25) * (1 - n.mkt02_n) + (w.des04 ?? 0.25) * n.des04_n + (w.des02 ?? 0.2) * n.des02_n;
  return Math.max(0, Math.min(100, raw * 100));
}
function computeExecutionRisk(n, w) {
  const raw = (w.executionResilience ?? 0.35) * n.executionResilience + (w.supplyChainInverse ?? 0.25) * (1 - n.exe01_n) + (w.complexityInverse ?? 0.2) * (1 - n.des03_n) + (w.approvalsInverse ?? 0.2) * (1 - n.exe03_n);
  return Math.max(0, Math.min(100, raw * 100));
}
function computePenalties(inputs, n, penaltyConfig) {
  const penalties = [];
  const riskFlags = [];
  const optionalFields = [
    inputs.mkt03Trend,
    inputs.fin03ShockTolerance,
    inputs.fin04SalesPremium,
    inputs.des04Experience,
    inputs.des05Sustainability,
    inputs.exe01SupplyChain,
    inputs.exe03Approvals,
    inputs.exe04QaMaturity
  ];
  const missingCount = optionalFields.filter(
    (v) => v === null || v === void 0
  ).length;
  if (missingCount / optionalFields.length > 0.3) {
    penalties.push({
      id: "P1",
      trigger: "missing_non_required_gt_30pct",
      effect: penaltyConfig?.P1?.effect ?? -5,
      description: "Missing non-required inputs > 30%"
    });
  }
  if (inputs.des01Style === "Other") {
    const effect = penaltyConfig?.P2?.effectEach ?? -3;
    penalties.push({
      id: "P2",
      trigger: "critical_enum_other",
      effect,
      description: "Design style set to 'Other'"
    });
  }
  if (n.budgetFit < 0.4) {
    penalties.push({
      id: "P3",
      trigger: "budget_fit_lt_0.4",
      effect: penaltyConfig?.P3?.effect ?? -10,
      flag: "FIN_SEVERE",
      description: "Budget fit below 0.4"
    });
    riskFlags.push("FIN_SEVERE");
  }
  if (n.executionResilience < 0.35) {
    penalties.push({
      id: "P4",
      trigger: "execution_resilience_lt_0.35",
      effect: penaltyConfig?.P4?.effect ?? -8,
      flag: "EXE_FRAGILE",
      description: "Execution resilience below 0.35"
    });
    riskFlags.push("EXE_FRAGILE");
  }
  if (n.des03_n > 0.8 && n.exe02_n < 0.5) {
    penalties.push({
      id: "P5",
      trigger: "complexity_contractor_mismatch",
      effect: penaltyConfig?.P5?.effect ?? -12,
      flag: "COMPLEXITY_MISMATCH",
      description: "High complexity with low contractor capability"
    });
    riskFlags.push("COMPLEXITY_MISMATCH");
  }
  return { penalties, riskFlags };
}
function generateConditionalActions(dimensions, riskFlags) {
  const actions = [];
  if (riskFlags.includes("FIN_SEVERE")) {
    actions.push({
      trigger: "FIN_SEVERE",
      recommendation: "Adjust specification level or budget range. Consider 2 alternative material tiers.",
      variables: ["fin01BudgetCap", "des02MaterialLevel"]
    });
  }
  if (riskFlags.includes("EXE_FRAGILE")) {
    actions.push({
      trigger: "EXE_FRAGILE",
      recommendation: "Simplify design complexity or upgrade contractor plan.",
      variables: ["des03Complexity", "exe02Contractor"]
    });
  }
  if (riskFlags.includes("COMPLEXITY_MISMATCH")) {
    actions.push({
      trigger: "COMPLEXITY_MISMATCH",
      recommendation: "Reduce custom joinery; modularize; phase high-complexity elements.",
      variables: ["des03Complexity", "exe02Contractor"]
    });
  }
  if (dimensions.sa < 60) {
    actions.push({
      trigger: "LOW_SA",
      recommendation: "Clarify target user profile and brand narrative.",
      variables: ["str01BrandClarity", "str03BuyerMaturity"]
    });
  }
  if (dimensions.mp < 60) {
    actions.push({
      trigger: "LOW_MP",
      recommendation: "Reposition experience intensity; adjust differentiation strategy.",
      variables: ["mkt02Competitor", "des04Experience"]
    });
  }
  return actions;
}
function computeComposite(dimensions, weights, penalties) {
  const totalPenalty = penalties.reduce((sum, p) => sum + p.effect, 0);
  const raw = weights.sa * dimensions.sa + weights.ff * dimensions.ff + weights.mp * dimensions.mp + weights.ds * dimensions.ds + weights.er * dimensions.er;
  return Math.max(0, Math.min(100, raw + totalPenalty));
}
function computeRiskScore(dimensions, n) {
  const risk = 100 - (0.35 * dimensions.er + 0.25 * dimensions.ff + 0.2 * n.budgetFit * 100 + 0.2 * n.executionResilience * 100);
  return Math.max(0, Math.min(100, risk));
}
function classifyDecision(compositeScore, riskScore) {
  if (compositeScore >= 75 && riskScore <= 45) return "validated";
  if (compositeScore < 60 || riskScore >= 60) return "not_validated";
  return "conditional";
}
function computeConfidence(inputs, benchmarkCount, overrideRate) {
  const allFields = Object.values(inputs);
  const provided = allFields.filter(
    (v) => v !== null && v !== void 0
  ).length;
  const inputCompleteness = provided / allFields.length;
  const minRequired = 3;
  const benchmarkDensity = Math.min(1, benchmarkCount / minRequired);
  const modelStability = 0.95;
  const overrideFactor = Math.max(0, 1 - overrideRate);
  const confidence = 0.3 * inputCompleteness + 0.25 * benchmarkDensity + 0.25 * modelStability + 0.2 * overrideFactor;
  return Math.max(0, Math.min(100, confidence * 100));
}
function computeVariableContributions(n, varWeights) {
  return {
    sa: {
      str01_n: n.str01_n * (varWeights.sa?.str01 ?? 0.35),
      str03_n: n.str03_n * (varWeights.sa?.str03 ?? 0.25),
      compatVisionMarket: n.compatVisionMarket * (varWeights.sa?.compatVisionMarket ?? 0.25),
      compatVisionDesign: n.compatVisionDesign * (varWeights.sa?.compatVisionDesign ?? 0.15)
    },
    ff: {
      budgetFit: n.budgetFit * (varWeights.ff?.budgetFit ?? 0.45),
      fin02_n: n.fin02_n * (varWeights.ff?.fin02 ?? 0.2),
      executionResilience: n.executionResilience * (varWeights.ff?.executionResilience ?? 0.2),
      costStability: (1 - n.costVolatility) * (varWeights.ff?.costStability ?? 0.15)
    },
    mp: {
      marketFit: n.marketFit * (varWeights.mp?.marketFit ?? 0.35),
      differentiationPressure: n.differentiationPressure * (varWeights.mp?.differentiationPressure ?? 0.25),
      des04_n: n.des04_n * (varWeights.mp?.des04 ?? 0.2),
      trendFit: n.trendFit * (varWeights.mp?.trendFit ?? 0.2)
    },
    ds: {
      str02_n: n.str02_n * (varWeights.ds?.str02 ?? 0.3),
      competitorInverse: (1 - n.mkt02_n) * (varWeights.ds?.competitorInverse ?? 0.25),
      des04_n: n.des04_n * (varWeights.ds?.des04 ?? 0.25),
      des02_n: n.des02_n * (varWeights.ds?.des02 ?? 0.2)
    },
    er: {
      executionResilience: n.executionResilience * (varWeights.er?.executionResilience ?? 0.35),
      supplyChainInverse: (1 - n.exe01_n) * (varWeights.er?.supplyChainInverse ?? 0.25),
      complexityInverse: (1 - n.des03_n) * (varWeights.er?.complexityInverse ?? 0.2),
      approvalsInverse: (1 - n.exe03_n) * (varWeights.er?.approvalsInverse ?? 0.2)
    }
  };
}
function computeROI(inputs, compositeScore, fee) {
  const gfa = inputs.ctx03Gfa ?? 5e5;
  const budgetCap = inputs.fin01BudgetCap ?? 400;
  const totalBudget = gfa * budgetCap;
  const reworkRate = 0.08 + compositeScore / 100 * 0.07;
  const reworkAvoided = totalBudget * reworkRate;
  const procRate = 0.03 + compositeScore / 100 * 0.05;
  const procurementSavings = totalBudget * procRate;
  const timeRate = 0.02 + compositeScore / 100 * 0.03;
  const timeValueGain = totalBudget * timeRate;
  const specRate = 0.01 + compositeScore / 100 * 0.02;
  const specEfficiency = totalBudget * specRate;
  const posRate = compositeScore / 100 * 0.05;
  const positioningPremium = totalBudget * posRate;
  const totalValue = reworkAvoided + procurementSavings + timeValueGain + specEfficiency + positioningPremium;
  const netROI = fee > 0 ? (totalValue - fee) / fee : 0;
  const roiMultiple = fee > 0 ? totalValue / fee : 0;
  return {
    reworkAvoided: Math.round(reworkAvoided),
    procurementSavings: Math.round(procurementSavings),
    timeValueGain: Math.round(timeValueGain),
    specEfficiency: Math.round(specEfficiency),
    positioningPremium: Math.round(positioningPremium),
    totalValue: Math.round(totalValue),
    fee,
    netROI: Math.round(netROI * 100) / 100,
    roiMultiple: Math.round(roiMultiple * 100) / 100
  };
}
function evaluate(inputs, config) {
  const n = normalizeInputs(inputs, config.expectedCost);
  const dimensions = {
    sa: computeStrategicAlignment(n, config.variableWeights.sa ?? {}),
    ff: computeFinancialFeasibility(n, config.variableWeights.ff ?? {}),
    mp: computeMarketPositioning(n, config.variableWeights.mp ?? {}),
    ds: computeDifferentiationStrength(n, config.variableWeights.ds ?? {}),
    er: computeExecutionRisk(n, config.variableWeights.er ?? {})
  };
  const { penalties, riskFlags } = computePenalties(
    inputs,
    n,
    config.penaltyConfig
  );
  const compositeScore = computeComposite(
    dimensions,
    config.dimensionWeights,
    penalties
  );
  const riskScore = computeRiskScore(dimensions, n);
  const rasScore = Math.max(0, compositeScore - 0.35 * riskScore);
  const confidenceScore = computeConfidence(
    inputs,
    config.benchmarkCount,
    config.overrideRate
  );
  const decisionStatus = classifyDecision(compositeScore, riskScore);
  const conditionalActions = generateConditionalActions(dimensions, riskFlags);
  const variableContributions = computeVariableContributions(
    n,
    config.variableWeights
  );
  return {
    dimensions,
    dimensionWeights: config.dimensionWeights,
    compositeScore: Math.round(compositeScore * 100) / 100,
    riskScore: Math.round(riskScore * 100) / 100,
    rasScore: Math.round(rasScore * 100) / 100,
    confidenceScore: Math.round(confidenceScore * 100) / 100,
    decisionStatus,
    penalties,
    riskFlags,
    conditionalActions,
    variableContributions,
    inputSnapshot: inputs
  };
}

// server/engines/sensitivity.ts
var PERTURBABLE_FIELDS = [
  { key: "str01BrandClarity", step: 1, type: "ordinal" },
  { key: "str02Differentiation", step: 1, type: "ordinal" },
  { key: "str03BuyerMaturity", step: 1, type: "ordinal" },
  { key: "mkt02Competitor", step: 1, type: "ordinal" },
  { key: "mkt03Trend", step: 1, type: "ordinal" },
  { key: "fin02Flexibility", step: 1, type: "ordinal" },
  { key: "fin03ShockTolerance", step: 1, type: "ordinal" },
  { key: "fin04SalesPremium", step: 1, type: "ordinal" },
  { key: "des02MaterialLevel", step: 1, type: "ordinal" },
  { key: "des03Complexity", step: 1, type: "ordinal" },
  { key: "des04Experience", step: 1, type: "ordinal" },
  { key: "des05Sustainability", step: 1, type: "ordinal" },
  { key: "exe01SupplyChain", step: 1, type: "ordinal" },
  { key: "exe02Contractor", step: 1, type: "ordinal" },
  { key: "exe03Approvals", step: 1, type: "ordinal" },
  { key: "exe04QaMaturity", step: 1, type: "ordinal" },
  { key: "fin01BudgetCap", step: 50, type: "numeric" }
];
function runSensitivityAnalysis(baseInputs, config) {
  const baseResult = evaluate(baseInputs, config);
  const baseScore = baseResult.compositeScore;
  const entries = [];
  for (const field of PERTURBABLE_FIELDS) {
    const currentVal = baseInputs[field.key];
    if (currentVal === null || currentVal === void 0) continue;
    const upInputs = { ...baseInputs };
    const upVal = field.type === "ordinal" ? Math.min(5, currentVal + field.step) : currentVal + field.step;
    upInputs[field.key] = upVal;
    const upResult = evaluate(upInputs, config);
    const downInputs = { ...baseInputs };
    const downVal = field.type === "ordinal" ? Math.max(1, currentVal - field.step) : Math.max(0, currentVal - field.step);
    downInputs[field.key] = downVal;
    const downResult = evaluate(downInputs, config);
    const sensitivity = Math.abs(upResult.compositeScore - downResult.compositeScore);
    entries.push({
      variable: field.key,
      sensitivity: Math.round(sensitivity * 100) / 100,
      scoreUp: Math.round(upResult.compositeScore * 100) / 100,
      scoreDown: Math.round(downResult.compositeScore * 100) / 100
    });
  }
  return entries.sort((a, b) => b.sensitivity - a.sensitivity);
}

// server/engines/report.ts
function generateValidationSummary(projectName, projectId, inputs, scoreResult, sensitivity) {
  return {
    reportType: "validation_summary",
    generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    projectName,
    projectId,
    sections: [
      {
        title: "Executive Summary",
        type: "summary",
        data: {
          compositeScore: scoreResult.compositeScore,
          rasScore: scoreResult.rasScore,
          decisionStatus: scoreResult.decisionStatus,
          confidenceScore: scoreResult.confidenceScore,
          riskFlags: scoreResult.riskFlags,
          statusLabel: scoreResult.decisionStatus === "validated" ? "Direction Validated" : scoreResult.decisionStatus === "conditional" ? "Conditionally Validated" : "Not Validated"
        }
      },
      {
        title: "Dimension Scores",
        type: "scores",
        data: {
          dimensions: scoreResult.dimensions,
          weights: scoreResult.dimensionWeights
        }
      },
      {
        title: "Radar Profile",
        type: "radar",
        data: scoreResult.dimensions
      },
      {
        title: "Risk Assessment",
        type: "risk",
        data: {
          riskScore: scoreResult.riskScore,
          penalties: scoreResult.penalties,
          riskFlags: scoreResult.riskFlags
        }
      },
      {
        title: "Sensitivity Analysis",
        type: "sensitivity",
        data: sensitivity.slice(0, 8)
      },
      {
        title: "Conditional Actions",
        type: "recommendations",
        data: scoreResult.conditionalActions
      }
    ]
  };
}
function generateDesignBrief(projectName, projectId, inputs, scoreResult, sensitivity) {
  const report = generateValidationSummary(projectName, projectId, inputs, scoreResult, sensitivity);
  report.reportType = "design_brief";
  report.sections.push({
    title: "Design Direction Parameters",
    type: "summary",
    data: {
      style: inputs.des01Style,
      materialLevel: inputs.des02MaterialLevel,
      complexity: inputs.des03Complexity,
      experienceIntensity: inputs.des04Experience,
      sustainability: inputs.des05Sustainability,
      targetMarket: inputs.mkt01Tier,
      location: inputs.ctx04Location
    }
  });
  report.sections.push({
    title: "Variable Contributions",
    type: "scores",
    data: scoreResult.variableContributions
  });
  return report;
}
function generateFullReport(projectName, projectId, inputs, scoreResult, sensitivity, roi) {
  const report = generateDesignBrief(projectName, projectId, inputs, scoreResult, sensitivity);
  report.reportType = "full_report";
  report.sections.push({
    title: "ROI Analysis",
    type: "roi",
    data: roi
  });
  return report;
}

// server/engines/pdf-report.ts
var DIMENSION_LABELS = {
  sa: "Strategic Alignment",
  ff: "Financial Feasibility",
  mp: "Market Positioning",
  ds: "Differentiation Strength",
  er: "Execution Risk"
};
function statusColor(status) {
  if (status === "validated") return "#4ecdc4";
  if (status === "conditional") return "#f0c674";
  return "#e07a5f";
}
function statusLabel(status) {
  if (status === "validated") return "VALIDATED";
  if (status === "conditional") return "CONDITIONALLY VALIDATED";
  return "NOT VALIDATED";
}
function scoreGrade(score) {
  if (score >= 80) return "Excellent";
  if (score >= 70) return "Strong";
  if (score >= 60) return "Moderate";
  if (score >= 50) return "Weak";
  return "Critical";
}
function formatDate() {
  return (/* @__PURE__ */ new Date()).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}
function generateWatermark(projectId, reportType) {
  const ts = Date.now().toString(36);
  const hash = `MYR-${reportType.toUpperCase().slice(0, 3)}-${projectId}-${ts}`;
  return hash;
}
function htmlHeader(title, subtitle, projectName, watermark) {
  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  @page { size: A4; margin: 20mm 15mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1a1a2e; line-height: 1.6; font-size: 11px; }
  .cover { page-break-after: always; display: flex; flex-direction: column; justify-content: center; align-items: center; min-height: 80vh; text-align: center; }
  .cover h1 { font-size: 28px; color: #0f3460; margin-bottom: 8px; letter-spacing: 1px; }
  .cover h2 { font-size: 16px; color: #4ecdc4; font-weight: 400; margin-bottom: 24px; }
  .cover .project { font-size: 20px; color: #1a1a2e; font-weight: 600; }
  .cover .date { font-size: 12px; color: #666; margin-top: 16px; }
  .cover .logo { font-size: 36px; font-weight: 800; color: #0f3460; letter-spacing: 3px; margin-bottom: 32px; }
  .cover .confidential { font-size: 10px; color: #999; margin-top: 40px; text-transform: uppercase; letter-spacing: 2px; }
  .cover .watermark { font-size: 8px; color: #ccc; margin-top: 8px; font-family: monospace; }
  h2 { font-size: 16px; color: #0f3460; border-bottom: 2px solid #4ecdc4; padding-bottom: 6px; margin: 24px 0 12px; }
  h3 { font-size: 13px; color: #0f3460; margin: 16px 0 8px; }
  p { margin-bottom: 8px; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 10px; }
  th { background: #0f3460; color: #fff; padding: 8px 10px; text-align: left; font-weight: 600; }
  td { padding: 6px 10px; border-bottom: 1px solid #e0e0e0; }
  tr:nth-child(even) td { background: #f8f9fa; }
  .score-box { display: inline-block; padding: 4px 12px; border-radius: 4px; font-weight: 700; font-size: 14px; }
  .status-badge { display: inline-block; padding: 6px 16px; border-radius: 4px; font-weight: 700; font-size: 12px; color: #fff; letter-spacing: 1px; }
  .metric-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 12px 0; }
  .metric-card { border: 1px solid #e0e0e0; border-radius: 6px; padding: 12px; text-align: center; }
  .metric-card .label { font-size: 9px; color: #666; text-transform: uppercase; letter-spacing: 1px; }
  .metric-card .value { font-size: 22px; font-weight: 700; color: #0f3460; margin: 4px 0; }
  .metric-card .grade { font-size: 10px; }
  .risk-flag { background: #fff3cd; border-left: 3px solid #f0c674; padding: 6px 10px; margin: 4px 0; font-size: 10px; }
  .action-item { background: #e8f5e9; border-left: 3px solid #4ecdc4; padding: 6px 10px; margin: 4px 0; font-size: 10px; }
  .penalty-item { background: #fce4ec; border-left: 3px solid #e07a5f; padding: 6px 10px; margin: 4px 0; font-size: 10px; }
  .lens-card { border: 1px solid #e0e0e0; border-radius: 6px; padding: 12px; margin: 8px 0; }
  .lens-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
  .lens-title { font-size: 12px; font-weight: 700; color: #0f3460; }
  .lens-score { font-size: 14px; font-weight: 700; }
  .lens-evidence { font-size: 9px; color: #666; margin-top: 4px; }
  .roi-highlight { background: linear-gradient(135deg, #e8f5e9, #f1f8e9); border: 1px solid #c8e6c9; border-radius: 8px; padding: 16px; margin: 12px 0; text-align: center; }
  .roi-value { font-size: 28px; font-weight: 800; color: #2e7d32; }
  .roi-label { font-size: 10px; color: #666; text-transform: uppercase; letter-spacing: 1px; }
  .evidence-trace { background: #f5f5f5; border: 1px solid #e0e0e0; border-radius: 4px; padding: 8px 12px; margin: 8px 0; font-size: 9px; font-family: monospace; color: #666; }
  .footer { margin-top: 40px; padding-top: 12px; border-top: 1px solid #e0e0e0; font-size: 9px; color: #999; text-align: center; }
  .section { page-break-inside: avoid; margin-bottom: 20px; }
  .repro-meta { background: #f0f4f8; border: 1px solid #d0d7de; border-radius: 6px; padding: 10px 14px; margin: 16px auto; max-width: 400px; font-size: 9px; color: #444; text-align: left; }
  .repro-meta .label { font-weight: 600; color: #0f3460; display: inline-block; min-width: 120px; }
  .citation-ref { font-size: 8px; color: #0f3460; vertical-align: super; font-weight: 600; cursor: help; }
</style>
</head>
<body>
<div class="cover">
  <div class="logo">MIYAR</div>
  <h1>${title}</h1>
  <h2>${subtitle}</h2>
  <div class="project">${projectName}</div>
  <div class="date">${formatDate()}</div>
  <div class="confidential">Confidential \u2014 For Internal Use Only</div>
  <div class="watermark">Document ID: ${watermark}</div>
  <div class="repro-meta">
    <div><span class="label">Scoring Engine:</span> MIYAR Decision Intelligence V2</div>
    <div><span class="label">Model Version:</span> v2.0.0</div>
    <div><span class="label">Generated:</span> ${(/* @__PURE__ */ new Date()).toISOString()}</div>
    <div><span class="label">Document ID:</span> ${watermark}</div>
    <div><span class="label">Reproducibility:</span> All inputs, weights, thresholds, and benchmark data are frozen at generation time. Re-evaluation with identical inputs and the same benchmark/logic version will produce identical scores.</div>
  </div>
</div>
`;
}
function renderEvidenceReferences(refs) {
  if (!refs || refs.length === 0) return `
<div class="section">
  <h2>Evidence References</h2>
  <p style="font-size:10px; color:#666;">No evidence records linked to this project at the time of report generation.</p>
</div>
`;
  const rows = refs.map((r, i) => {
    const gradeColor = r.reliabilityGrade === "A" ? "#2e7d32" : r.reliabilityGrade === "B" ? "#f57c00" : "#c62828";
    return `<tr>
    <td><span class="citation-ref">[${i + 1}]</span></td>
    <td>${r.title}</td>
    <td>${r.category || "\u2014"}</td>
    <td style="color:${gradeColor}; font-weight:600;">${r.reliabilityGrade || "\u2014"}</td>
    <td>${r.captureDate ? new Date(r.captureDate).toLocaleDateString() : "\u2014"}</td>
    <td>${r.sourceUrl ? `<a href="${r.sourceUrl}" style="color:#0f3460;">[link]</a>` : "\u2014"}</td>
  </tr>`;
  }).join("");
  return `
<div class="section">
  <h2>Evidence References</h2>
  <p style="font-size:9px; color:#666; margin-bottom:8px;">The following evidence records were linked to this project at the time of report generation. Inline citations <span class="citation-ref">[n]</span> in the report body reference entries in this table.</p>
  <table>
    <tr><th>Ref</th><th>Title</th><th>Category</th><th>Grade</th><th>Captured</th><th>Source</th></tr>
    ${rows}
  </table>
  <p style="font-size:8px; color:#999; margin-top:4px;">Grade A = Primary institutional source | Grade B = Verified commercial source | Grade C = Self-reported or unverified</p>
</div>
`;
}
function renderDisclaimer() {
  return `
<div class="section" style="margin-top:24px; padding:12px; background:#fff8e1; border:1px solid #ffe082; border-radius:6px;">
  <h3 style="color:#e65100; font-size:11px; margin-bottom:6px;">Important Disclaimer</h3>
  <p style="font-size:9px; color:#5d4037; line-height:1.5;">
    This document is a <strong>concept-level assessment</strong> generated by the MIYAR Decision Intelligence Platform.
    All scores, recommendations, and specifications are <strong>advisory only</strong> and are subject to detailed design,
    engineering review, and professional validation. Material specifications, cost estimates, and procurement guidance
    are indicative and must be confirmed through formal tender processes. MIYAR does not warrant the accuracy of
    third-party benchmark data or market intelligence used in this assessment. This document does not constitute
    professional design, financial, or legal advice.
  </p>
</div>
`;
}
function htmlFooter(projectId, reportType, watermark, benchmarkVersion, logicVersion) {
  return `
${renderDisclaimer()}
<div class="footer">
  MIYAR Decision Intelligence Platform V2 | Document ID: ${watermark} | Generated: ${formatDate()}<br>
  Model Version: v2.0.0 | Benchmark Version: ${benchmarkVersion || "v1.0-baseline"} | Logic Version: ${logicVersion || "v1.0-default"}<br>
  <span style="font-size:8px;">This report is auto-generated and watermarked. Scores are advisory and do not constitute professional design or financial advice.</span>
</div>
</body>
</html>
`;
}
function renderExecutiveSummary(scoreResult) {
  return `
<div class="section">
  <h2>Executive Summary</h2>
  <div style="text-align: center; margin: 16px 0;">
    <div class="status-badge" style="background: ${statusColor(scoreResult.decisionStatus)};">
      ${statusLabel(scoreResult.decisionStatus)}
    </div>
  </div>
  <div class="metric-grid">
    <div class="metric-card">
      <div class="label">Composite Score</div>
      <div class="value">${scoreResult.compositeScore.toFixed(1)}</div>
      <div class="grade">${scoreGrade(scoreResult.compositeScore)}</div>
    </div>
    <div class="metric-card">
      <div class="label">Risk-Adjusted Score</div>
      <div class="value" style="color: ${statusColor(scoreResult.decisionStatus)};">${scoreResult.rasScore.toFixed(1)}</div>
      <div class="grade">${scoreGrade(scoreResult.rasScore)}</div>
    </div>
    <div class="metric-card">
      <div class="label">Confidence</div>
      <div class="value">${scoreResult.confidenceScore.toFixed(0)}%</div>
      <div class="grade">${scoreResult.confidenceScore >= 75 ? "High" : scoreResult.confidenceScore >= 50 ? "Moderate" : "Low"}</div>
    </div>
  </div>
</div>
`;
}
function renderDimensionTable(scoreResult) {
  const dims = ["sa", "ff", "mp", "ds", "er"];
  const rows = dims.map((d) => {
    const score = scoreResult.dimensions[d];
    const weight = scoreResult.dimensionWeights[d];
    const weighted = score * weight;
    return `<tr>
      <td>${DIMENSION_LABELS[d]}</td>
      <td style="text-align:center; font-weight:700;">${score.toFixed(1)}</td>
      <td style="text-align:center;">${(weight * 100).toFixed(0)}%</td>
      <td style="text-align:center;">${weighted.toFixed(1)}</td>
      <td style="text-align:center;">${scoreGrade(score)}</td>
    </tr>`;
  }).join("");
  return `
<div class="section">
  <h2>Dimension Score Breakdown</h2>
  <table>
    <tr><th>Dimension</th><th>Score (0-100)</th><th>Weight</th><th>Weighted</th><th>Grade</th></tr>
    ${rows}
    <tr style="font-weight:700; background:#f0f4f8;">
      <td>Composite</td>
      <td style="text-align:center;">${scoreResult.compositeScore.toFixed(1)}</td>
      <td style="text-align:center;">100%</td>
      <td style="text-align:center;">${scoreResult.compositeScore.toFixed(1)}</td>
      <td style="text-align:center;">${scoreGrade(scoreResult.compositeScore)}</td>
    </tr>
  </table>
</div>
`;
}
function renderRiskAssessment(scoreResult) {
  const penalties = scoreResult.penalties.map(
    (p) => `<div class="penalty-item"><strong>${p.id}:</strong> ${p.description} (Effect: ${p.effect > 0 ? "+" : ""}${p.effect.toFixed(1)})</div>`
  ).join("");
  const flags = scoreResult.riskFlags.map(
    (f) => `<div class="risk-flag">${f}</div>`
  ).join("");
  return `
<div class="section">
  <h2>Risk Assessment</h2>
  <div class="metric-grid" style="grid-template-columns: repeat(2, 1fr);">
    <div class="metric-card">
      <div class="label">Risk Score</div>
      <div class="value" style="color: ${scoreResult.riskScore <= 45 ? "#4ecdc4" : scoreResult.riskScore <= 60 ? "#f0c674" : "#e07a5f"};">${scoreResult.riskScore.toFixed(1)}</div>
    </div>
    <div class="metric-card">
      <div class="label">Penalties Applied</div>
      <div class="value">${scoreResult.penalties.length}</div>
    </div>
  </div>
  ${scoreResult.penalties.length > 0 ? `<h3>Active Penalties</h3>${penalties}` : ""}
  ${scoreResult.riskFlags.length > 0 ? `<h3>Risk Flags</h3>${flags}` : "<p>No risk flags triggered.</p>"}
</div>
`;
}
function renderSensitivity(sensitivity) {
  const top = sensitivity.slice(0, 8);
  const rows = top.map((s) => {
    return `<tr>
      <td>${s.variable}</td>
      <td style="text-align:center;">${Math.abs(s.sensitivity).toFixed(2)}</td>
      <td style="text-align:center;">${s.scoreUp.toFixed(1)}</td>
      <td style="text-align:center;">${s.scoreDown.toFixed(1)}</td>
      <td style="text-align:center;">${(s.scoreUp - s.scoreDown).toFixed(1)}</td>
    </tr>`;
  }).join("");
  return `
<div class="section">
  <h2>Sensitivity Analysis</h2>
  <p>Top ${top.length} variables ranked by impact on composite score when adjusted \xB11 unit:</p>
  <table>
    <tr><th>Variable</th><th>Sensitivity</th><th>Score (+1)</th><th>Score (-1)</th><th>Range</th></tr>
    ${rows}
  </table>
</div>
`;
}
function renderConditionalActions(scoreResult) {
  if (scoreResult.conditionalActions.length === 0) {
    return `<div class="section"><h2>Recommended Actions</h2><p>No conditional actions required. All parameters are within acceptable ranges.</p></div>`;
  }
  const actions = scoreResult.conditionalActions.map(
    (a) => `<div class="action-item">
      <strong>Trigger:</strong> ${a.trigger}<br>
      <strong>Recommendation:</strong> ${a.recommendation}<br>
      <strong>Variables:</strong> ${a.variables.join(", ")}
    </div>`
  ).join("");
  return `
<div class="section">
  <h2>Recommended Actions</h2>
  <p>${scoreResult.conditionalActions.length} conditional action(s) identified:</p>
  ${actions}
</div>
`;
}
function renderInputSummary(inputs) {
  const groups = [
    {
      title: "Context",
      items: [
        ["Typology", inputs.ctx01Typology],
        ["Scale", inputs.ctx02Scale],
        ["GFA (sqm)", inputs.ctx03Gfa ? inputs.ctx03Gfa.toLocaleString() : "N/A"],
        ["Location", inputs.ctx04Location],
        ["Delivery Horizon", inputs.ctx05Horizon]
      ]
    },
    {
      title: "Strategy",
      items: [
        ["Brand Clarity", `${inputs.str01BrandClarity}/5`],
        ["Differentiation", `${inputs.str02Differentiation}/5`],
        ["Buyer Maturity", `${inputs.str03BuyerMaturity}/5`]
      ]
    },
    {
      title: "Market",
      items: [
        ["Market Tier", inputs.mkt01Tier],
        ["Competitor Intensity", `${inputs.mkt02Competitor}/5`],
        ["Trend Sensitivity", `${inputs.mkt03Trend}/5`]
      ]
    },
    {
      title: "Financial",
      items: [
        ["Budget Cap (AED/sqft)", inputs.fin01BudgetCap ? inputs.fin01BudgetCap.toLocaleString() : "N/A"],
        ["Flexibility", `${inputs.fin02Flexibility}/5`],
        ["Shock Tolerance", `${inputs.fin03ShockTolerance}/5`],
        ["Sales Premium", `${inputs.fin04SalesPremium}/5`]
      ]
    },
    {
      title: "Design",
      items: [
        ["Style", inputs.des01Style],
        ["Material Level", `${inputs.des02MaterialLevel}/5`],
        ["Complexity", `${inputs.des03Complexity}/5`],
        ["Experience", `${inputs.des04Experience}/5`],
        ["Sustainability", `${inputs.des05Sustainability}/5`]
      ]
    },
    {
      title: "Execution",
      items: [
        ["Supply Chain", `${inputs.exe01SupplyChain}/5`],
        ["Contractor", `${inputs.exe02Contractor}/5`],
        ["Approvals", `${inputs.exe03Approvals}/5`],
        ["QA Maturity", `${inputs.exe04QaMaturity}/5`]
      ]
    }
  ];
  const tables = groups.map((g) => {
    const rows = g.items.map(([k, v]) => `<tr><td style="width:50%;">${k}</td><td>${v}</td></tr>`).join("");
    return `<h3>${g.title}</h3><table><tr><th>Parameter</th><th>Value</th></tr>${rows}</table>`;
  }).join("");
  return `<div class="section"><h2>Project Input Summary</h2>${tables}</div>`;
}
function renderVariableContributions(contributions) {
  const dims = Object.keys(contributions);
  const sections = dims.map((dim) => {
    const vars = contributions[dim];
    const sorted = Object.entries(vars).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
    const rows = sorted.map(
      ([v, c]) => `<tr><td>${v}</td><td style="text-align:center; color: ${c >= 0 ? "#4ecdc4" : "#e07a5f"}; font-weight:600;">${c >= 0 ? "+" : ""}${c.toFixed(2)}</td></tr>`
    ).join("");
    return `<h3>${DIMENSION_LABELS[dim] || dim}</h3><table><tr><th>Variable</th><th>Contribution</th></tr>${rows}</table>`;
  }).join("");
  return `<div class="section"><h2>Variable Contribution Analysis</h2><p>How each input variable contributes to each dimension score:</p>${sections}</div>`;
}
function renderROINarrative(roi) {
  if (!roi) return "";
  const totalValue = roi.totalCostAvoided?.mid || roi.totalCostAvoided?.base || roi.totalValue || roi.totalValueCreated || 0;
  const roiMultiple = roi.roiMultiple || (totalValue > 0 ? totalValue / 15e4 : 0);
  const drivers = roi.drivers || roi.components || Object.entries(roi).filter(([k, v]) => typeof v === "number" && k !== "totalValue" && k !== "roiMultiple" && k !== "fee" && k !== "netROI").map(([name, value]) => ({ name, value })) || [];
  return `
<div class="section">
  <h2>ROI & Economic Impact Analysis</h2>
  
  <div class="roi-highlight">
    <div class="roi-label">Total Value Created</div>
    <div class="roi-value">AED ${Number(totalValue).toLocaleString()}</div>
    <div style="font-size:10px; color:#666; margin-top:4px;">ROI Multiple: ${Number(roiMultiple).toFixed(1)}x</div>
  </div>

  <h3>Value Breakdown</h3>
  <table>
    <tr><th>Value Component</th><th>Conservative</th><th>Base</th><th>Aggressive</th></tr>
    ${drivers.length > 0 ? drivers.map((c) => `
    <tr>
      <td><strong>${c.name}</strong><br><span style="font-size:9px; color:#666;">${c.description || c.narrative || ""}</span></td>
      <td style="text-align:right;">AED ${Number(c.costAvoided?.conservative || c.conservative || (c.value ? c.value * 0.8 : 0)).toLocaleString()}</td>
      <td style="text-align:right; font-weight:600;">AED ${Number(c.costAvoided?.mid || c.base || c.value || 0).toLocaleString()}</td>
      <td style="text-align:right;">AED ${Number(c.costAvoided?.aggressive || c.aggressive || (c.value ? c.value * 1.2 : 0)).toLocaleString()}</td>
    </tr>`).join("") : `
    <tr><td>Rework Avoided</td><td style="text-align:right;" colspan="3">AED ${Number(roi.reworkAvoided || 0).toLocaleString()}</td></tr>
    <tr><td>Procurement Savings</td><td style="text-align:right;" colspan="3">AED ${Number(roi.procurementSavings || 0).toLocaleString()}</td></tr>
    <tr><td>Time-Value Gain</td><td style="text-align:right;" colspan="3">AED ${Number(roi.timeValueGain || 0).toLocaleString()}</td></tr>
    <tr><td>Spec Efficiency</td><td style="text-align:right;" colspan="3">AED ${Number(roi.specEfficiency || 0).toLocaleString()}</td></tr>
    <tr><td>Positioning Premium</td><td style="text-align:right;" colspan="3">AED ${Number(roi.positioningPremium || 0).toLocaleString()}</td></tr>
    `}
  </table>

  ${roi.narrative ? `
  <h3>Executive Narrative</h3>
  <p style="font-size:10px; line-height:1.6;">${roi.narrative}</p>
  ` : ""}

  ${roi.assumptions ? `
  <h3>Key Assumptions</h3>
  <ul style="font-size:9px; color:#666; padding-left:16px;">
    ${roi.assumptions.map((a) => `<li>${a}</li>`).join("")}
  </ul>
  ` : `
  <p style="margin-top:12px; font-size:10px; color:#666;">
    <em>Assumptions: Rework avoidance based on industry benchmarks (15-25% of construction cost for misaligned projects). 
    Procurement savings estimated at 3-8% through validated specifications. Time-value calculated using standard cost-of-capital models.</em>
  </p>
  `}
</div>
`;
}
function renderFiveLens(fiveLens) {
  if (!fiveLens) return "";
  const LENS_ICONS = {
    "Market Fit Lens": "\u{1F4CA}",
    "Cost Discipline Lens": "\u{1F4B0}",
    "Brand/Vision Alignment Lens": "\u{1F3A8}",
    "Procurement Feasibility Lens": "\u2699\uFE0F",
    "Differentiation Lens": "\u{1F3AF}"
  };
  const lensCards = (fiveLens.lenses || []).map((lens) => {
    const color = lens.score >= 70 ? "#4ecdc4" : lens.score >= 50 ? "#f0c674" : "#e07a5f";
    const icon = LENS_ICONS[lens.lensName] || "\u{1F50D}";
    return `
    <div class="lens-card">
      <div class="lens-header">
        <div class="lens-title">${icon} ${lens.lensName}</div>
        <div class="lens-score" style="color:${color};">${(lens.score || 0).toFixed(0)}/100</div>
      </div>
      <p style="font-size:10px; margin-bottom:6px;">${lens.rationale || ""}</p>
      ${lens.evidence && lens.evidence.length > 0 ? `
      <div class="lens-evidence">
        <strong>Evidence:</strong> ${lens.evidence.slice(0, 3).map((e) => typeof e === "string" ? e : e.label && e.value ? `${e.label}: ${e.value}` : JSON.stringify(e)).join(" \u2022 ")}
      </div>
      ` : ""}
      ${lens.gaps && lens.gaps.length > 0 ? `
      <div style="font-size:9px; color:#e07a5f; margin-top:4px;">
        <strong>Gaps:</strong> ${lens.gaps.slice(0, 2).join(" \u2022 ")}
      </div>
      ` : ""}
    </div>`;
  }).join("");
  return `
<div class="section">
  <h2>5-Lens Defensibility Framework</h2>
  <div class="metric-grid" style="grid-template-columns: repeat(2, 1fr);">
    <div class="metric-card">
      <div class="label">Overall Defensibility</div>
      <div class="value" style="color: ${fiveLens.overallScore >= 70 ? "#4ecdc4" : fiveLens.overallScore >= 50 ? "#f0c674" : "#e07a5f"};">
        ${fiveLens.overallScore.toFixed(0)}
      </div>
      <div class="grade">${fiveLens.overallVerdict || scoreGrade(fiveLens.overallScore)}</div>
    </div>
    <div class="metric-card">
      <div class="label">Weakest Lens</div>
      <div class="value" style="font-size:14px; color:#e07a5f;">${fiveLens.weakestLens || "\u2014"}</div>
      <div class="grade">Priority improvement area</div>
    </div>
  </div>
  ${lensCards}
</div>
`;
}
function renderEvidenceTrace(projectId, watermark, benchmarkVersion, logicVersion) {
  return `
<div class="section">
  <h2>Evidence Trace & Provenance</h2>
  <div class="evidence-trace">
    Document ID: ${watermark}<br>
    Project ID: ${projectId}<br>
    Benchmark Version: ${benchmarkVersion || "v1.0-baseline"}<br>
    Logic Version: ${logicVersion || "v1.0-default"}<br>
    Model Version: v2.0.0<br>
    Generated: ${(/* @__PURE__ */ new Date()).toISOString()}<br>
    Scoring Engine: MIYAR Decision Intelligence V2<br>
    Hash: ${Buffer.from(watermark + projectId).toString("base64").slice(0, 16)}
  </div>
  <p style="font-size:9px; color:#666; margin-top:8px;">
    This document contains a cryptographic evidence trace linking the scoring inputs, benchmark data version,
    logic version (weights + thresholds), and model configuration used at the time of generation. Any modification
    to the underlying data would produce a different document hash, ensuring auditability and defensibility of the decision record.
  </p>
</div>
`;
}
function renderROI(roi) {
  return `
<div class="section">
  <h2>ROI & Economic Impact Analysis</h2>
  <div class="roi-highlight">
    <div class="roi-label">Total Value Created</div>
    <div class="roi-value">AED ${roi.totalValue.toLocaleString()}</div>
    <div style="font-size:10px; color:#666; margin-top:4px;">ROI Multiple: ${roi.roiMultiple.toFixed(1)}x</div>
  </div>
  <table>
    <tr><th>Value Component</th><th>Amount (AED)</th></tr>
    <tr><td>Rework Avoided</td><td style="text-align:right;">${roi.reworkAvoided.toLocaleString()}</td></tr>
    <tr><td>Procurement Savings</td><td style="text-align:right;">${roi.procurementSavings.toLocaleString()}</td></tr>
    <tr><td>Time-Value Gain</td><td style="text-align:right;">${roi.timeValueGain.toLocaleString()}</td></tr>
    <tr><td>Spec Efficiency</td><td style="text-align:right;">${roi.specEfficiency.toLocaleString()}</td></tr>
    <tr><td>Positioning Premium</td><td style="text-align:right;">${roi.positioningPremium.toLocaleString()}</td></tr>
    <tr style="font-weight:700; background:#e8f5e9;"><td>Total Value Created</td><td style="text-align:right;">${roi.totalValue.toLocaleString()}</td></tr>
    <tr><td>MIYAR Fee</td><td style="text-align:right;">(${roi.fee.toLocaleString()})</td></tr>
    <tr style="font-weight:700; background:#f0f4f8;"><td>Net ROI</td><td style="text-align:right;">${roi.netROI.toLocaleString()}</td></tr>
    <tr style="font-weight:700;"><td>ROI Multiple</td><td style="text-align:right;">${roi.roiMultiple.toFixed(1)}x</td></tr>
  </table>
</div>
`;
}
function renderBoardAnnex(boardSummaries) {
  if (!boardSummaries || boardSummaries.length === 0) {
    return `
<div class="section">
  <h2>Material Board Annex</h2>
  <p style="font-size:10px; color:#666;">No material boards have been created for this project. Use the Board Composer to build material boards with cost estimates and RFQ-ready procurement schedules.</p>
</div>
`;
  }
  const boardCards = boardSummaries.map((b) => {
    const tierRows = Object.entries(b.tierDistribution).map(
      ([tier, count]) => `<span style="display:inline-block; margin-right:8px; font-size:9px;"><strong>${tier.replace("_", " ")}:</strong> ${count}</span>`
    ).join("");
    return `
    <div style="border:1px solid #e0e0e0; border-radius:6px; padding:12px; margin:8px 0; page-break-inside:avoid;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <span style="font-size:12px; font-weight:700; color:#0f3460;">${b.boardName}</span>
        <span style="font-size:10px; color:#666;">${b.totalItems} items</span>
      </div>
      <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin-bottom:8px;">
        <div style="text-align:center;">
          <div style="font-size:8px; color:#666; text-transform:uppercase;">Cost Range</div>
          <div style="font-size:12px; font-weight:700; color:#0f3460;">${b.estimatedCostLow.toLocaleString()} \u2013 ${b.estimatedCostHigh.toLocaleString()} ${b.currency}</div>
        </div>
        <div style="text-align:center;">
          <div style="font-size:8px; color:#666; text-transform:uppercase;">Longest Lead</div>
          <div style="font-size:12px; font-weight:700; color:#0f3460;">${b.longestLeadTimeDays}d</div>
        </div>
        <div style="text-align:center;">
          <div style="font-size:8px; color:#666; text-transform:uppercase;">Critical Items</div>
          <div style="font-size:12px; font-weight:700; color:${b.criticalPathItems.length > 0 ? "#dc2626" : "#16a34a"};">${b.criticalPathItems.length}</div>
        </div>
      </div>
      <div style="font-size:9px; color:#444;">${tierRows}</div>
      ${b.criticalPathItems.length > 0 ? `<div style="margin-top:6px;"><span style="font-size:9px; color:#dc2626; font-weight:600;">Critical:</span> <span style="font-size:9px; color:#666;">${b.criticalPathItems.join(", ")}</span></div>` : ""}
    </div>`;
  }).join("");
  return `
<div class="section">
  <h2>Material Board Annex</h2>
  <p style="font-size:10px; color:#666; margin-bottom:8px;">The following material boards have been composed for this project. Each board includes cost estimates, lead time analysis, and tier distribution. Full RFQ-ready procurement schedules are available via the Board Composer export.</p>
  ${boardCards}
</div>
`;
}
function parseMarkdownToHTML(markdown) {
  let html = markdown || "";
  html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");
  const lines = html.split("\\n");
  const parsedLines = [];
  let inList = false;
  for (let line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("### ")) {
      if (inList) {
        parsedLines.push("</ul>");
        inList = false;
      }
      parsedLines.push(`<h3>${trimmed.slice(4)}</h3>`);
    } else if (trimmed.startsWith("## ")) {
      if (inList) {
        parsedLines.push("</ul>");
        inList = false;
      }
      parsedLines.push(`<h2>${trimmed.slice(3)}</h2>`);
    } else if (trimmed.startsWith("# ")) {
      if (inList) {
        parsedLines.push("</ul>");
        inList = false;
      }
      parsedLines.push(`<h2>${trimmed.slice(2)}</h2>`);
    } else if (trimmed.match(/^[\\-\\*]\\s+/)) {
      if (!inList) {
        parsedLines.push('<ul style="margin-left: 20px; margin-bottom: 8px;">');
        inList = true;
      }
      parsedLines.push(`<li style="margin-bottom: 4px;">${trimmed.replace(/^[\\-\\*]\\s+/, "")}</li>`);
    } else if (trimmed !== "") {
      if (inList) {
        parsedLines.push("</ul>");
        inList = false;
      }
      parsedLines.push(`<p>${trimmed}</p>`);
    }
  }
  if (inList) parsedLines.push("</ul>");
  return `<div class="section markdown-body">${parsedLines.join("\\n")}</div>`;
}
function generateAutonomousBriefHTML(data) {
  const watermark = generateWatermark(data.projectId, "autonomous_design_brief");
  const contentHtml = parseMarkdownToHTML(data.autonomousContent || "No content generated.");
  return [
    htmlHeader("Autonomous Design Brief", "AI-Generated Concept & Technical Specification", data.projectName, watermark),
    contentHtml,
    renderEvidenceTrace(data.projectId, watermark, data.benchmarkVersion, data.logicVersion),
    htmlFooter(data.projectId, "autonomous_design_brief", watermark, data.benchmarkVersion, data.logicVersion)
  ].join("\\n");
}
function generateValidationSummaryHTML(data) {
  const watermark = generateWatermark(data.projectId, "validation_summary");
  return [
    htmlHeader("Executive Decision Pack", "Interior Design Direction Assessment", data.projectName, watermark),
    renderExecutiveSummary(data.scoreResult),
    renderDimensionTable(data.scoreResult),
    renderRiskAssessment(data.scoreResult),
    renderSensitivity(data.sensitivity),
    renderConditionalActions(data.scoreResult),
    data.fiveLens ? renderFiveLens(data.fiveLens) : "",
    renderEvidenceReferences(data.evidenceRefs),
    renderEvidenceTrace(data.projectId, watermark, data.benchmarkVersion, data.logicVersion),
    renderInputSummary(data.inputs),
    htmlFooter(data.projectId, "validation_summary", watermark, data.benchmarkVersion, data.logicVersion)
  ].join("\n");
}
function generateDesignBriefHTML(data) {
  const watermark = generateWatermark(data.projectId, "design_brief");
  return [
    htmlHeader("Design Brief + RFQ Pack", "Technical Specification & Variable Analysis", data.projectName, watermark),
    renderExecutiveSummary(data.scoreResult),
    renderDimensionTable(data.scoreResult),
    renderVariableContributions(data.scoreResult.variableContributions),
    renderSensitivity(data.sensitivity),
    renderRiskAssessment(data.scoreResult),
    renderConditionalActions(data.scoreResult),
    data.fiveLens ? renderFiveLens(data.fiveLens) : "",
    renderBoardAnnex(data.boardSummaries),
    renderEvidenceReferences(data.evidenceRefs),
    renderEvidenceTrace(data.projectId, watermark, data.benchmarkVersion, data.logicVersion),
    renderInputSummary(data.inputs),
    htmlFooter(data.projectId, "design_brief", watermark, data.benchmarkVersion, data.logicVersion)
  ].join("\n");
}
function generateFullReportHTML(data) {
  const watermark = generateWatermark(data.projectId, "full_report");
  const sections = [
    htmlHeader("Full Evaluation Report", "Comprehensive Decision Intelligence Analysis", data.projectName, watermark),
    renderExecutiveSummary(data.scoreResult),
    renderDimensionTable(data.scoreResult),
    renderVariableContributions(data.scoreResult.variableContributions),
    renderSensitivity(data.sensitivity),
    renderRiskAssessment(data.scoreResult),
    renderConditionalActions(data.scoreResult)
  ];
  if (data.fiveLens) {
    sections.push(renderFiveLens(data.fiveLens));
  }
  if (data.roiNarrative) {
    sections.push(renderROINarrative(data.roiNarrative));
  } else if (data.roi) {
    sections.push(renderROI(data.roi));
  }
  sections.push(renderBoardAnnex(data.boardSummaries));
  sections.push(renderEvidenceReferences(data.evidenceRefs));
  sections.push(renderEvidenceTrace(data.projectId, watermark, data.benchmarkVersion, data.logicVersion));
  sections.push(renderInputSummary(data.inputs));
  sections.push(htmlFooter(data.projectId, "full_report", watermark, data.benchmarkVersion, data.logicVersion));
  return sections.join("\n");
}
function renderScenarioComparisonTable(data) {
  const dims = ["sa", "ff", "mp", "ds", "er"];
  const baseScores = data.baselineScenario.scores ?? {};
  const headerCols = [
    `<th>Dimension</th>`,
    `<th style="text-align:center;">Baseline<br><span style="font-size:8px;font-weight:400;">${data.baselineScenario.name}</span></th>`,
    ...data.comparedScenarios.map(
      (s, i) => `<th style="text-align:center;">Scenario ${String.fromCharCode(65 + i)}<br><span style="font-size:8px;font-weight:400;">${s.name}</span></th>`
    )
  ].join("");
  const rows = dims.map((d) => {
    const baseVal = baseScores[`${d}Score`] ?? baseScores[d] ?? 0;
    const cells = data.comparedScenarios.map((s) => {
      const sScores = s.scores ?? {};
      const val = sScores[`${d}Score`] ?? sScores[d] ?? 0;
      const delta = val - baseVal;
      const color = delta > 0 ? "#2e7d32" : delta < 0 ? "#c62828" : "#666";
      const arrow = delta > 0 ? "\u25B2" : delta < 0 ? "\u25BC" : "\u2014";
      return `<td style="text-align:center;">${val.toFixed(1)} <span style="color:${color};font-size:9px;">${arrow} ${delta !== 0 ? Math.abs(delta).toFixed(1) : ""}</span></td>`;
    }).join("");
    return `<tr><td>${DIMENSION_LABELS[d]}</td><td style="text-align:center;font-weight:700;">${baseVal.toFixed(1)}</td>${cells}</tr>`;
  }).join("");
  const baseComposite = baseScores.compositeScore ?? baseScores.composite ?? 0;
  const compositeCells = data.comparedScenarios.map((s) => {
    const sScores = s.scores ?? {};
    const val = sScores.compositeScore ?? sScores.composite ?? 0;
    const delta = val - baseComposite;
    const color = delta > 0 ? "#2e7d32" : delta < 0 ? "#c62828" : "#666";
    const arrow = delta > 0 ? "\u25B2" : delta < 0 ? "\u25BC" : "\u2014";
    return `<td style="text-align:center;font-weight:700;">${val.toFixed(1)} <span style="color:${color};font-size:9px;">${arrow} ${delta !== 0 ? Math.abs(delta).toFixed(1) : ""}</span></td>`;
  }).join("");
  return `
<div class="section">
  <h2>Scenario Score Comparison</h2>
  <table>
    <tr>${headerCols}</tr>
    ${rows}
    <tr style="font-weight:700; background:#f0f4f8;">
      <td>Composite Score</td>
      <td style="text-align:center;">${baseComposite.toFixed(1)}</td>
      ${compositeCells}
    </tr>
  </table>
</div>
`;
}
function renderROIComparison(data) {
  const baseRoi = data.baselineScenario.roi ?? {};
  if (!baseRoi.totalValue && data.comparedScenarios.every((s) => !s.roi)) return "";
  const metrics = ["totalValue", "reworkAvoided", "procurementSavings", "timeValueGain"];
  const metricLabels = {
    totalValue: "Total Value Created",
    reworkAvoided: "Rework Avoided",
    procurementSavings: "Procurement Savings",
    timeValueGain: "Time-Value Gain"
  };
  const headerCols = [
    `<th>ROI Metric</th>`,
    `<th style="text-align:right;">Baseline</th>`,
    ...data.comparedScenarios.map(
      (s, i) => `<th style="text-align:right;">Scenario ${String.fromCharCode(65 + i)}</th>`
    )
  ].join("");
  const rows = metrics.map((m) => {
    const baseVal = baseRoi[m] ?? 0;
    const cells = data.comparedScenarios.map((s) => {
      const sRoi = s.roi ?? {};
      const val = sRoi[m] ?? 0;
      return `<td style="text-align:right;">AED ${val.toLocaleString()}</td>`;
    }).join("");
    return `<tr><td>${metricLabels[m] ?? m}</td><td style="text-align:right;">AED ${baseVal.toLocaleString()}</td>${cells}</tr>`;
  }).join("");
  return `
<div class="section">
  <h2>ROI Comparison</h2>
  <table>
    <tr>${headerCols}</tr>
    ${rows}
  </table>
</div>
`;
}
function renderTradeoffAnalysis(data) {
  const analyses = data.comparedScenarios.map((s, i) => {
    const deltas = s.deltas ?? {};
    const positives = Object.entries(deltas).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    const negatives = Object.entries(deltas).filter(([, v]) => v < 0).sort((a, b) => a[1] - b[1]);
    const posItems = positives.slice(0, 3).map(
      ([k, v]) => `<div class="action-item">${DIMENSION_LABELS[k.replace("Score", "")] ?? k}: +${v.toFixed(1)} points</div>`
    ).join("");
    const negItems = negatives.slice(0, 3).map(
      ([k, v]) => `<div class="penalty-item">${DIMENSION_LABELS[k.replace("Score", "")] ?? k}: ${v.toFixed(1)} points</div>`
    ).join("");
    return `
    <h3>Scenario ${String.fromCharCode(65 + i)}: ${s.name}</h3>
    ${positives.length > 0 ? `<p><strong>Improvements vs Baseline:</strong></p>${posItems}` : "<p>No improvements over baseline.</p>"}
    ${negatives.length > 0 ? `<p><strong>Trade-offs vs Baseline:</strong></p>${negItems}` : "<p>No trade-offs identified.</p>"}
    `;
  }).join("");
  return `
<div class="section">
  <h2>Trade-off Analysis</h2>
  ${analyses}
  ${data.decisionNote ? `<h3>Decision Note</h3><p>${data.decisionNote}</p>` : ""}
</div>
`;
}
function generateScenarioComparisonHTML(data) {
  const watermark = generateWatermark(data.projectId, "scenario_comparison");
  return [
    htmlHeader("Scenario Comparison Pack", "Decision Tradeoff Analysis", data.projectName, watermark),
    renderScenarioComparisonTable(data),
    renderROIComparison(data),
    renderTradeoffAnalysis(data),
    renderEvidenceTrace(data.projectId, watermark, data.benchmarkVersion, data.logicVersion),
    htmlFooter(data.projectId, "scenario_comparison", watermark, data.benchmarkVersion, data.logicVersion)
  ].join("\n");
}
function generateReportHTML(reportType, data) {
  switch (reportType) {
    case "validation_summary":
      return generateValidationSummaryHTML(data);
    case "design_brief":
      return generateDesignBriefHTML(data);
    case "full_report":
      return generateFullReportHTML(data);
    case "autonomous_design_brief":
      return generateAutonomousBriefHTML(data);
    default:
      return generateValidationSummaryHTML(data);
  }
}

// server/storage.ts
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Buffer as Buffer2 } from "node:buffer";
import process2 from "node:process";
import fs from "node:fs/promises";
import path from "node:path";
function getS3Client() {
  const region = process2.env.AWS_REGION || "us-east-1";
  const accessKeyId = process2.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process2.env.AWS_SECRET_ACCESS_KEY;
  const bucketName = process2.env.AWS_S3_BUCKET;
  if (!accessKeyId || !secretAccessKey || !bucketName) {
    if (process2.env.NODE_ENV === "production") {
      console.warn("Missing AWS S3 credentials");
    }
  }
  const client = new S3Client({
    region,
    credentials: accessKeyId && secretAccessKey ? {
      accessKeyId,
      secretAccessKey
    } : void 0
  });
  return { client, bucketName };
}
function normalizeKey(relKey) {
  return relKey.replace(/^\/+/, "");
}
async function storagePut(relKey, data, contentType = "application/octet-stream") {
  const { client, bucketName } = getS3Client();
  const key = normalizeKey(relKey);
  if (!bucketName) {
    const localPath = path.join(process2.cwd(), "client", "public", "uploads", key);
    await fs.mkdir(path.dirname(localPath), { recursive: true });
    await fs.writeFile(localPath, typeof data === "string" ? Buffer2.from(data, "utf-8") : data);
    return { key, url: `/uploads/${key}` };
  }
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: typeof data === "string" ? Buffer2.from(data, "utf-8") : data,
    ContentType: contentType
  });
  await client.send(command);
  const getCommand = new GetObjectCommand({
    Bucket: bucketName,
    Key: key
  });
  const url = await getSignedUrl(client, getCommand, { expiresIn: 3600 * 24 * 7 });
  return { key, url };
}

// server/routers/project.ts
import { nanoid } from "nanoid";

// server/engines/roi.ts
var DEFAULT_COEFFICIENTS = {
  hourlyRate: 350,
  reworkCostPct: 0.12,
  tenderIterationCost: 25e3,
  designCycleCost: 45e3,
  budgetVarianceMultiplier: 0.08,
  timeAccelerationWeeks: 6,
  conservativeMultiplier: 0.6,
  aggressiveMultiplier: 1.4
};
function tierMultiplier(tier) {
  switch (tier) {
    case "Ultra-luxury":
      return 2;
    case "Luxury":
      return 1.5;
    case "Upper-mid":
      return 1.2;
    default:
      return 1;
  }
}
function horizonWeeks(horizon) {
  switch (horizon) {
    case "0-12m":
      return 26;
    case "12-24m":
      return 52;
    case "24-36m":
      return 78;
    case "36m+":
      return 104;
    default:
      return 52;
  }
}
function computeRoi(inputs, coefficients) {
  const c = { ...DEFAULT_COEFFICIENTS, ...coefficients };
  const tm = tierMultiplier(inputs.tier);
  const scoreNorm = inputs.compositeScore / 100;
  const riskNorm = inputs.riskScore / 100;
  const confNorm = inputs.confidenceScore / 100;
  const complexityNorm = inputs.complexity / 5;
  const baseDesignCycles = Math.max(1, Math.round(3 + complexityNorm * 2 - scoreNorm * 2));
  const cyclesAvoided = Math.max(1, baseDesignCycles - 1);
  const designHours = cyclesAvoided * 120 * tm;
  const designCost = cyclesAvoided * c.designCycleCost * tm;
  const baseTenderIterations = Math.max(1, Math.round(2 + complexityNorm * 2));
  const tenderReduced = Math.max(1, Math.round(baseTenderIterations * scoreNorm * 0.6));
  const tenderHours = tenderReduced * 40;
  const tenderCost = tenderReduced * c.tenderIterationCost;
  const baseReworkPct = c.reworkCostPct * (1 + riskNorm);
  const reducedReworkPct = baseReworkPct * (1 - scoreNorm * 0.5);
  const reworkSaving = inputs.budgetCap * (baseReworkPct - reducedReworkPct);
  const reworkHours = reworkSaving / c.hourlyRate;
  const baseVariance = c.budgetVarianceMultiplier * (1 + complexityNorm * 0.5);
  const reducedVariance = baseVariance * (1 - confNorm * 0.4);
  const varianceSaving = inputs.budgetCap * (baseVariance - reducedVariance);
  const varianceHours = varianceSaving / c.hourlyRate;
  const baseWeeks = horizonWeeks(inputs.horizon);
  const accelerationWeeks = Math.round(c.timeAccelerationWeeks * scoreNorm * tm * 0.5);
  const timeHours = accelerationWeeks * 40;
  const timeCost = accelerationWeeks * 40 * c.hourlyRate * 0.3;
  const drivers = [
    {
      name: "Design Cycles Avoided",
      description: `Reduced from ${baseDesignCycles} to ${baseDesignCycles - cyclesAvoided} design iterations through validated direction`,
      hoursSaved: {
        conservative: Math.round(designHours * c.conservativeMultiplier),
        mid: Math.round(designHours),
        aggressive: Math.round(designHours * c.aggressiveMultiplier)
      },
      costAvoided: {
        conservative: Math.round(designCost * c.conservativeMultiplier),
        mid: Math.round(designCost),
        aggressive: Math.round(designCost * c.aggressiveMultiplier)
      },
      assumptions: [
        `${cyclesAvoided} design cycle(s) eliminated`,
        `${Math.round(120 * tm)} hours per cycle at ${inputs.tier} tier`,
        `AED ${c.designCycleCost.toLocaleString()} per cycle base cost`
      ]
    },
    {
      name: "Tender Iterations Reduced",
      description: `Reduced from ${baseTenderIterations} to ${baseTenderIterations - tenderReduced} tender rounds`,
      hoursSaved: {
        conservative: Math.round(tenderHours * c.conservativeMultiplier),
        mid: Math.round(tenderHours),
        aggressive: Math.round(tenderHours * c.aggressiveMultiplier)
      },
      costAvoided: {
        conservative: Math.round(tenderCost * c.conservativeMultiplier),
        mid: Math.round(tenderCost),
        aggressive: Math.round(tenderCost * c.aggressiveMultiplier)
      },
      assumptions: [
        `${tenderReduced} tender iteration(s) eliminated`,
        `AED ${c.tenderIterationCost.toLocaleString()} per iteration`,
        `40 hours per tender round`
      ]
    },
    {
      name: "Rework Probability Reduction",
      description: `Rework risk reduced from ${(baseReworkPct * 100).toFixed(1)}% to ${(reducedReworkPct * 100).toFixed(1)}%`,
      hoursSaved: {
        conservative: Math.round(reworkHours * c.conservativeMultiplier),
        mid: Math.round(reworkHours),
        aggressive: Math.round(reworkHours * c.aggressiveMultiplier)
      },
      costAvoided: {
        conservative: Math.round(reworkSaving * c.conservativeMultiplier),
        mid: Math.round(reworkSaving),
        aggressive: Math.round(reworkSaving * c.aggressiveMultiplier)
      },
      assumptions: [
        `Budget cap: AED ${inputs.budgetCap.toLocaleString()}`,
        `Base rework rate: ${(baseReworkPct * 100).toFixed(1)}%`,
        `MIYAR-validated rate: ${(reducedReworkPct * 100).toFixed(1)}%`
      ]
    },
    {
      name: "Budget Variance Risk Reduction",
      description: `Budget variance band narrowed from \xB1${(baseVariance * 100).toFixed(1)}% to \xB1${(reducedVariance * 100).toFixed(1)}%`,
      hoursSaved: {
        conservative: Math.round(varianceHours * c.conservativeMultiplier),
        mid: Math.round(varianceHours),
        aggressive: Math.round(varianceHours * c.aggressiveMultiplier)
      },
      costAvoided: {
        conservative: Math.round(varianceSaving * c.conservativeMultiplier),
        mid: Math.round(varianceSaving),
        aggressive: Math.round(varianceSaving * c.aggressiveMultiplier)
      },
      assumptions: [
        `Budget cap: AED ${inputs.budgetCap.toLocaleString()}`,
        `Variance reduced by ${((baseVariance - reducedVariance) * 100).toFixed(1)} percentage points`
      ]
    },
    {
      name: "Time-to-Brief Acceleration",
      description: `Project timeline accelerated by ${accelerationWeeks} weeks`,
      hoursSaved: {
        conservative: Math.round(timeHours * c.conservativeMultiplier),
        mid: Math.round(timeHours),
        aggressive: Math.round(timeHours * c.aggressiveMultiplier)
      },
      costAvoided: {
        conservative: Math.round(timeCost * c.conservativeMultiplier),
        mid: Math.round(timeCost),
        aggressive: Math.round(timeCost * c.aggressiveMultiplier)
      },
      assumptions: [
        `${accelerationWeeks} weeks saved from ${baseWeeks}-week baseline`,
        `Opportunity cost at 30% of hourly rate`
      ]
    }
  ];
  const totalHoursMid = drivers.reduce((s, d) => s + d.hoursSaved.mid, 0);
  const totalCostMid = drivers.reduce((s, d) => s + d.costAvoided.mid, 0);
  return {
    totalHoursSaved: {
      conservative: drivers.reduce((s, d) => s + d.hoursSaved.conservative, 0),
      mid: totalHoursMid,
      aggressive: drivers.reduce((s, d) => s + d.hoursSaved.aggressive, 0)
    },
    totalCostAvoided: {
      conservative: drivers.reduce((s, d) => s + d.costAvoided.conservative, 0),
      mid: totalCostMid,
      aggressive: drivers.reduce((s, d) => s + d.costAvoided.aggressive, 0)
    },
    budgetAccuracyGain: {
      fromPct: Math.round(baseVariance * 100 * 10) / 10,
      toPct: Math.round(reducedVariance * 100 * 10) / 10
    },
    decisionConfidenceIndex: Math.round(confNorm * scoreNorm * 100),
    drivers,
    assumptions: [
      `Hourly rate: AED ${c.hourlyRate}`,
      `Market tier: ${inputs.tier} (multiplier: ${tm}x)`,
      `Project horizon: ${inputs.horizon}`,
      `Composite score: ${inputs.compositeScore}/100`,
      `Risk score: ${inputs.riskScore}/100`,
      `Conservative scenario: ${(c.conservativeMultiplier * 100).toFixed(0)}% of mid estimate`,
      `Aggressive scenario: ${(c.aggressiveMultiplier * 100).toFixed(0)}% of mid estimate`
    ],
    timeToBreifWeeks: {
      before: baseWeeks,
      after: Math.max(1, baseWeeks - accelerationWeeks)
    }
  };
}

// server/engines/five-lens.ts
function grade(score) {
  if (score >= 80) return "A";
  if (score >= 65) return "B";
  if (score >= 50) return "C";
  if (score >= 35) return "D";
  return "F";
}
function overallGradeFromScore(score) {
  if (score >= 80) return "Validated";
  if (score >= 60) return "Conditionally Validated";
  return "Not Validated";
}
function computeFiveLens(project, scoreMatrix, benchmarks) {
  const contributions = scoreMatrix.variableContributions || {};
  const penalties = scoreMatrix.penalties || [];
  const penaltyNames = penalties.map((p) => p.name || p.type || "Unknown");
  const mpScore = Number(scoreMatrix.mpScore);
  const marketEvidence = [
    { variable: "mkt01Tier", label: "Market Tier", value: project.mkt01Tier || "Upper-mid", weight: 0.35, contribution: contributions.mkt01Tier?.contribution || 0 },
    { variable: "mkt02Competitor", label: "Competitor Intensity", value: project.mkt02Competitor || 3, weight: 0.3, contribution: contributions.mkt02Competitor?.contribution || 0 },
    { variable: "mkt03Trend", label: "Trend Sensitivity", value: project.mkt03Trend || 3, weight: 0.2, contribution: contributions.mkt03Trend?.contribution || 0 },
    { variable: "str03BuyerMaturity", label: "Buyer Maturity", value: project.str03BuyerMaturity || 3, weight: 0.15, contribution: contributions.str03BuyerMaturity?.contribution || 0 }
  ];
  const relevantBenchmarks = benchmarks.filter((b) => b.marketTier === project.mkt01Tier);
  if (relevantBenchmarks.length > 0) {
    marketEvidence[0].benchmarkRef = `${relevantBenchmarks.length} benchmark records for ${project.mkt01Tier} tier`;
  }
  const ffScore = Number(scoreMatrix.ffScore);
  const costEvidence = [
    { variable: "fin01BudgetCap", label: "Budget Cap (AED/sqft)", value: Number(project.fin01BudgetCap || 0), weight: 0.3, contribution: contributions.fin01BudgetCap?.contribution || 0 },
    { variable: "fin02Flexibility", label: "Budget Flexibility", value: project.fin02Flexibility || 3, weight: 0.25, contribution: contributions.fin02Flexibility?.contribution || 0 },
    { variable: "fin03ShockTolerance", label: "Shock Tolerance", value: project.fin03ShockTolerance || 3, weight: 0.25, contribution: contributions.fin03ShockTolerance?.contribution || 0 },
    { variable: "fin04SalesPremium", label: "Sales Premium Potential", value: project.fin04SalesPremium || 3, weight: 0.2, contribution: contributions.fin04SalesPremium?.contribution || 0 }
  ];
  const saScore = Number(scoreMatrix.saScore);
  const diffEvidence = [
    { variable: "str01BrandClarity", label: "Brand Clarity", value: project.str01BrandClarity || 3, weight: 0.35, contribution: contributions.str01BrandClarity?.contribution || 0 },
    { variable: "str02Differentiation", label: "Differentiation Score", value: project.str02Differentiation || 3, weight: 0.4, contribution: contributions.str02Differentiation?.contribution || 0 },
    { variable: "des01Style", label: "Design Style", value: project.des01Style || "Modern", weight: 0.25, contribution: contributions.des01Style?.contribution || 0 }
  ];
  const erScore = Number(scoreMatrix.erScore);
  const procEvidence = [
    { variable: "exe01SupplyChain", label: "Supply Chain Readiness", value: project.exe01SupplyChain || 3, weight: 0.3, contribution: contributions.exe01SupplyChain?.contribution || 0 },
    { variable: "exe02Contractor", label: "Contractor Capability", value: project.exe02Contractor || 3, weight: 0.25, contribution: contributions.exe02Contractor?.contribution || 0 },
    { variable: "exe03Approvals", label: "Approvals Readiness", value: project.exe03Approvals || 2, weight: 0.2, contribution: contributions.exe03Approvals?.contribution || 0 },
    { variable: "exe04QaMaturity", label: "QA Maturity", value: project.exe04QaMaturity || 3, weight: 0.25, contribution: contributions.exe04QaMaturity?.contribution || 0 }
  ];
  const dsScore = Number(scoreMatrix.dsScore);
  const brandEvidence = [
    { variable: "des02MaterialLevel", label: "Material Level", value: project.des02MaterialLevel || 3, weight: 0.25, contribution: contributions.des02MaterialLevel?.contribution || 0 },
    { variable: "des03Complexity", label: "Design Complexity", value: project.des03Complexity || 3, weight: 0.2, contribution: contributions.des03Complexity?.contribution || 0 },
    { variable: "des04Experience", label: "Experience Quality", value: project.des04Experience || 3, weight: 0.3, contribution: contributions.des04Experience?.contribution || 0 },
    { variable: "des05Sustainability", label: "Sustainability", value: project.des05Sustainability || 2, weight: 0.25, contribution: contributions.des05Sustainability?.contribution || 0 }
  ];
  const lenses = [
    {
      lensId: 1,
      lensName: "Market Fit Lens",
      lensKey: "market_fit",
      score: mpScore,
      maxScore: 100,
      grade: grade(mpScore),
      evidence: marketEvidence,
      penalties: penaltyNames.filter((p) => p.toLowerCase().includes("market") || p.toLowerCase().includes("tier")),
      rationale: `The project scores ${mpScore.toFixed(1)}/100 on market fit, positioning it within the ${project.mkt01Tier} tier with ${project.mkt02Competitor === 5 ? "high" : project.mkt02Competitor === 1 ? "low" : "moderate"} competitive intensity. ${mpScore >= 70 ? "Strong alignment with target market benchmarks." : mpScore >= 50 ? "Adequate market positioning with room for improvement." : "Significant gaps in market alignment require attention."}`
    },
    {
      lensId: 2,
      lensName: "Cost Discipline Lens",
      lensKey: "cost_discipline",
      score: ffScore,
      maxScore: 100,
      grade: grade(ffScore),
      evidence: costEvidence,
      penalties: penaltyNames.filter((p) => p.toLowerCase().includes("budget") || p.toLowerCase().includes("cost") || p.toLowerCase().includes("financial")),
      rationale: `Financial feasibility scores ${ffScore.toFixed(1)}/100. Budget cap of AED ${Number(project.fin01BudgetCap || 0).toLocaleString()}/sqft with flexibility rating ${project.fin02Flexibility}/5. ${ffScore >= 70 ? "Budget is well-calibrated to market expectations." : ffScore >= 50 ? "Budget is within acceptable range but may face pressure." : "Budget constraints pose significant risk to project delivery."}`
    },
    {
      lensId: 3,
      lensName: "Differentiation Lens",
      lensKey: "differentiation",
      score: saScore,
      maxScore: 100,
      grade: grade(saScore),
      evidence: diffEvidence,
      penalties: penaltyNames.filter((p) => p.toLowerCase().includes("brand") || p.toLowerCase().includes("differentiation") || p.toLowerCase().includes("strategic")),
      rationale: `Strategic alignment scores ${saScore.toFixed(1)}/100. Brand clarity at ${project.str01BrandClarity}/5 with differentiation at ${project.str02Differentiation}/5 in ${project.des01Style} style. ${saScore >= 70 ? "Strong differentiation positions this project competitively." : saScore >= 50 ? "Moderate differentiation \u2014 consider strengthening unique value proposition." : "Weak differentiation may lead to commoditization risk."}`
    },
    {
      lensId: 4,
      lensName: "Procurement Feasibility Lens",
      lensKey: "procurement_feasibility",
      score: erScore,
      maxScore: 100,
      grade: grade(erScore),
      evidence: procEvidence,
      penalties: penaltyNames.filter((p) => p.toLowerCase().includes("execution") || p.toLowerCase().includes("supply") || p.toLowerCase().includes("procurement")),
      rationale: `Execution readiness scores ${erScore.toFixed(1)}/100. Supply chain readiness at ${project.exe01SupplyChain}/5 with contractor capability at ${project.exe02Contractor}/5. ${erScore >= 70 ? "Strong execution infrastructure supports timely delivery." : erScore >= 50 ? "Execution capabilities are adequate but may need reinforcement." : "Significant execution gaps require mitigation before proceeding."}`
    },
    {
      lensId: 5,
      lensName: "Brand/Vision Alignment Lens",
      lensKey: "brand_vision",
      score: dsScore,
      maxScore: 100,
      grade: grade(dsScore),
      evidence: brandEvidence,
      penalties: penaltyNames.filter((p) => p.toLowerCase().includes("design") || p.toLowerCase().includes("material") || p.toLowerCase().includes("complexity")),
      rationale: `Design specification scores ${dsScore.toFixed(1)}/100. Material level ${project.des02MaterialLevel}/5 with complexity ${project.des03Complexity}/5 and experience quality ${project.des04Experience}/5. ${dsScore >= 70 ? "Design vision is coherent and achievable." : dsScore >= 50 ? "Design ambition is moderate \u2014 ensure alignment with budget." : "Design specifications may be misaligned with project constraints."}`
    }
  ];
  const overallScore = Number(scoreMatrix.compositeScore);
  return {
    frameworkVersion: "MIYAR-5L-v2.0",
    lenses,
    overallGrade: overallGradeFromScore(overallScore),
    overallScore,
    watermark: `MIYAR Decision Intelligence Platform \u2014 Proprietary 5-Lens Validation Framework v2.0`,
    attribution: `This analysis was generated using the MIYAR 5-Lens Validation Framework, a proprietary decision intelligence methodology. All scores, insights, and recommendations are produced through deterministic algorithms calibrated against UAE/Dubai market benchmarks. \xA9 ${(/* @__PURE__ */ new Date()).getFullYear()} MIYAR. All rights reserved.`
  };
}

// server/engines/intelligence.ts
function classifyCostBand(budgetCap, tier) {
  const bands = {
    "Mid": [150, 250, 350],
    "Upper-mid": [250, 380, 500],
    "Luxury": [400, 600, 850],
    "Ultra-luxury": [650, 900, 1400]
  };
  const [low, mid, high] = bands[tier] || [200, 350, 500];
  if (budgetCap <= low) return "below_market";
  if (budgetCap <= mid) return "market_low";
  if (budgetCap <= high) return "market_mid";
  return "market_high";
}
function classifyStyleFamily(style) {
  const families = {
    "Modern": "contemporary_minimalist",
    "Contemporary": "contemporary_minimalist",
    "Minimal": "contemporary_minimalist",
    "Classic": "traditional_heritage",
    "Fusion": "eclectic_fusion",
    "Other": "custom"
  };
  return families[style] || "custom";
}
function computeDerivedFeatures(project, scoreMatrix, benchmarks, allScores) {
  const budgetCap = Number(project.fin01BudgetCap || 0);
  const tier = project.mkt01Tier || "Upper-mid";
  const complexity = project.des03Complexity || 3;
  const materialLevel = project.des02MaterialLevel || 3;
  const supplyChain = project.exe01SupplyChain || 3;
  const compositeScore = Number(scoreMatrix.compositeScore);
  const relevantBenchmarks = benchmarks.filter(
    (b) => b.typology === project.ctx01Typology && b.marketTier === tier
  );
  const avgBenchmarkCost = relevantBenchmarks.length > 0 ? relevantBenchmarks.reduce((s, b) => s + Number(b.costPerSqftMid || 0), 0) / relevantBenchmarks.length : 400;
  const costDeltaVsBenchmark = budgetCap > 0 ? (budgetCap - avgBenchmarkCost) / avgBenchmarkCost * 100 : 0;
  const diff = project.str02Differentiation || 3;
  const uniquenessIndex = Math.min(1, Math.max(0, (diff * 0.4 + materialLevel * 0.3 + complexity * 0.3) / 5));
  const feasibilityFlags = [];
  if (budgetCap > 0 && budgetCap < avgBenchmarkCost * 0.7) {
    feasibilityFlags.push({
      flag: "budget_below_benchmark",
      severity: "critical",
      description: `Budget is ${Math.round((1 - budgetCap / avgBenchmarkCost) * 100)}% below market benchmark`
    });
  }
  if (complexity >= 4 && supplyChain <= 2) {
    feasibilityFlags.push({
      flag: "complexity_supply_mismatch",
      severity: "warning",
      description: "High complexity with low supply chain readiness"
    });
  }
  if (materialLevel >= 4 && project.ctx05Horizon === "0-12m") {
    feasibilityFlags.push({
      flag: "timeline_material_risk",
      severity: "warning",
      description: "Premium materials may not be procurable within 12-month horizon"
    });
  }
  if (Number(scoreMatrix.riskScore) > 60) {
    feasibilityFlags.push({
      flag: "elevated_risk",
      severity: "warning",
      description: `Risk score ${Number(scoreMatrix.riskScore).toFixed(1)} exceeds threshold`
    });
  }
  const riskNorm = Number(scoreMatrix.riskScore) / 100;
  const complexityNorm = complexity / 5;
  const reworkRiskIndex = Math.min(1, riskNorm * 0.5 + complexityNorm * 0.3 + (1 - compositeScore / 100) * 0.2);
  const procurementComplexity = Math.min(1, (materialLevel * 0.4 + complexity * 0.3 + (6 - supplyChain) * 0.3) / 5);
  const sameClassScores = allScores.filter((s) => {
    const snap = s.inputSnapshot;
    return snap?.mkt01Tier === tier;
  }).map((s) => Number(s.compositeScore)).sort((a, b) => a - b);
  let tierPercentile = 0.5;
  if (sameClassScores.length > 1) {
    const rank = sameClassScores.filter((s) => s <= compositeScore).length;
    tierPercentile = rank / sameClassScores.length;
  }
  return {
    costDeltaVsBenchmark: Math.round(costDeltaVsBenchmark * 100) / 100,
    uniquenessIndex: Math.round(uniquenessIndex * 1e4) / 1e4,
    feasibilityFlags,
    reworkRiskIndex: Math.round(reworkRiskIndex * 1e4) / 1e4,
    procurementComplexity: Math.round(procurementComplexity * 1e4) / 1e4,
    tierPercentile: Math.round(tierPercentile * 1e4) / 1e4,
    styleFamily: classifyStyleFamily(project.des01Style || "Modern"),
    costBand: classifyCostBand(budgetCap, tier)
  };
}

// server/engines/scenario-templates.ts
var SCENARIO_TEMPLATES = [
  {
    key: "cost_discipline",
    name: "Cost Discipline",
    description: "Optimize for budget efficiency while maintaining acceptable quality. Reduces material level and complexity to lower cost bands.",
    overrides: {
      des02MaterialLevel: 2,
      des03Complexity: 2,
      fin02Flexibility: 4,
      fin03ShockTolerance: 4,
      exe01SupplyChain: 4
    },
    tradeoffs: [
      "Lower material specification may reduce perceived luxury",
      "Simplified design reduces differentiation potential",
      "Improved budget headroom and shock absorption",
      "Faster procurement with simpler supply chain"
    ]
  },
  {
    key: "market_differentiation",
    name: "Market Differentiation",
    description: "Maximize competitive differentiation through bold design choices and premium positioning. Increases brand clarity and design ambition.",
    overrides: {
      str01BrandClarity: 5,
      str02Differentiation: 5,
      des03Complexity: 4,
      des04Experience: 5,
      mkt03Trend: 4
    },
    tradeoffs: [
      "Higher design complexity increases execution risk",
      "Premium positioning narrows buyer pool",
      "Stronger brand identity commands premium pricing",
      "Trend-forward design may require specialized contractors"
    ]
  },
  {
    key: "luxury_upgrade",
    name: "Luxury Upgrade",
    description: "Elevate project to luxury tier with premium materials, high experience quality, and international-grade specifications.",
    overrides: {
      des02MaterialLevel: 5,
      des03Complexity: 4,
      des04Experience: 5,
      des05Sustainability: 3,
      str01BrandClarity: 4
    },
    tradeoffs: [
      "Significant budget increase required",
      "Extended procurement timelines for premium materials",
      "Higher risk of supply chain disruption",
      "Premium pricing potential with luxury positioning"
    ]
  },
  {
    key: "fast_delivery",
    name: "Fast Delivery / Procurement Simplicity",
    description: "Optimize for speed and procurement simplicity. Uses locally available materials and proven contractors.",
    overrides: {
      exe01SupplyChain: 5,
      exe02Contractor: 4,
      exe03Approvals: 4,
      des02MaterialLevel: 2,
      des03Complexity: 2
    },
    tradeoffs: [
      "Limited material palette reduces design options",
      "Simplified execution accelerates timeline",
      "Lower procurement risk with local sourcing",
      "May sacrifice uniqueness for speed"
    ]
  },
  {
    key: "brand_alignment",
    name: "Brand/Story Alignment",
    description: "Align all design and execution decisions with a strong brand narrative. Prioritizes coherence between vision, materials, and market positioning.",
    overrides: {
      str01BrandClarity: 5,
      str02Differentiation: 4,
      des04Experience: 5,
      des05Sustainability: 4,
      mkt03Trend: 4
    },
    tradeoffs: [
      "Brand-driven decisions may conflict with cost optimization",
      "Sustainability focus adds procurement complexity",
      "Strong narrative supports marketing and sales",
      "Experience-focused design requires careful execution"
    ]
  }
];
function getScenarioTemplate(key) {
  return SCENARIO_TEMPLATES.find((t2) => t2.key === key);
}
function checkConstraint(value, constraint) {
  if (value === void 0 || value === null) return false;
  const numVal = typeof value === "string" ? parseFloat(value) : value;
  switch (constraint.operator) {
    case "eq":
      return value === constraint.value || numVal === constraint.value;
    case "gte":
      return typeof constraint.value === "number" && numVal >= constraint.value;
    case "lte":
      return typeof constraint.value === "number" && numVal <= constraint.value;
    case "in":
      return Array.isArray(constraint.value) && constraint.value.includes(value);
    default:
      return false;
  }
}
function solveConstraints(baseProject, constraints) {
  const results = [];
  for (const template of SCENARIO_TEMPLATES) {
    const variant = { ...baseProject, ...template.overrides };
    let satisfied = 0;
    for (const c of constraints) {
      if (checkConstraint(variant[c.variable], c)) {
        satisfied++;
      }
    }
    const pct = constraints.length > 0 ? satisfied / constraints.length * 100 : 100;
    let impact = "neutral";
    if (pct >= 80) impact = "positive \u2014 meets most constraints";
    else if (pct >= 50) impact = "mixed \u2014 partial constraint satisfaction";
    else impact = "negative \u2014 significant constraint violations";
    results.push({
      name: template.name,
      description: template.description,
      overrides: template.overrides,
      estimatedScoreImpact: impact,
      constraintsSatisfied: satisfied,
      constraintsTotal: constraints.length
    });
  }
  const customOverrides = {};
  for (const c of constraints) {
    if (c.operator === "eq") {
      customOverrides[c.variable] = c.value;
    } else if (c.operator === "gte" && typeof c.value === "number") {
      const current = typeof baseProject[c.variable] === "number" ? baseProject[c.variable] : 3;
      customOverrides[c.variable] = Math.max(current, c.value);
    } else if (c.operator === "lte" && typeof c.value === "number") {
      const current = typeof baseProject[c.variable] === "number" ? baseProject[c.variable] : 3;
      customOverrides[c.variable] = Math.min(current, c.value);
    }
  }
  if (Object.keys(customOverrides).length > 0) {
    results.push({
      name: "Custom Optimized",
      description: "Auto-generated variant that directly satisfies all specified constraints",
      overrides: customOverrides,
      estimatedScoreImpact: "targeted \u2014 directly addresses constraints",
      constraintsSatisfied: constraints.length,
      constraintsTotal: constraints.length
    });
  }
  results.sort((a, b) => b.constraintsSatisfied - a.constraintsSatisfied);
  return results.slice(0, 3);
}

// server/engines/webhook.ts
import crypto2 from "crypto";
function signPayload(payload, secret) {
  return crypto2.createHmac("sha256", secret).update(payload).digest("hex");
}
function applyFieldMapping(data, mapping) {
  if (!mapping) return data;
  const mapped = {};
  for (const [miyarField, crmField] of Object.entries(mapping)) {
    if (data[miyarField] !== void 0) {
      mapped[crmField] = data[miyarField];
    }
  }
  for (const [key, value] of Object.entries(data)) {
    if (!mapping[key]) {
      mapped[key] = value;
    }
  }
  return mapped;
}
async function dispatchWebhook(event, data) {
  const configs = await getActiveWebhookConfigs(event);
  const results = [];
  let sent = 0;
  let failed = 0;
  for (const config of configs) {
    const payload = {
      event,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      data: applyFieldMapping(data, config.fieldMapping)
    };
    const body = JSON.stringify(payload);
    const headers = {
      "Content-Type": "application/json",
      "X-MIYAR-Event": event,
      "X-MIYAR-Timestamp": payload.timestamp
    };
    if (config.secret) {
      headers["X-MIYAR-Signature"] = signPayload(body, config.secret);
    }
    try {
      const url = typeof config.url === "string" ? config.url : "";
      const response = await fetch(url, {
        method: "POST",
        headers,
        body,
        signal: AbortSignal.timeout(1e4)
      });
      await updateWebhookConfig(config.id, {
        lastTriggeredAt: /* @__PURE__ */ new Date(),
        lastStatus: response.status
      });
      if (response.ok) {
        sent++;
        results.push({ webhookId: config.id, status: response.status });
      } else {
        failed++;
        results.push({ webhookId: config.id, status: response.status, error: `HTTP ${response.status}` });
      }
    } catch (err) {
      failed++;
      await updateWebhookConfig(config.id, {
        lastTriggeredAt: /* @__PURE__ */ new Date(),
        lastStatus: 0
      });
      results.push({ webhookId: config.id, status: null, error: err.message });
    }
  }
  return { sent, failed, results };
}

// server/engines/analytics/insight-generator.ts
init_llm();
var COST_PRESSURE_THRESHOLD = 10;
var MARKET_OPPORTUNITY_MIN_COMPETITORS = 3;
var POSITIONING_GAP_PERCENTILE_LOW = 25;
var POSITIONING_GAP_PERCENTILE_HIGH = 75;
var TREND_SIGNAL_MIN_CHANGE = 5;
var CONFIDENCE_WEIGHTS = {
  high: 0.9,
  medium: 0.65,
  low: 0.4,
  insufficient: 0.2
};
function checkCostPressure(input) {
  if (!input.trends) return null;
  const risingCosts = input.trends.filter(
    (t2) => t2.direction === "rising" && t2.percentChange !== null && t2.percentChange > COST_PRESSURE_THRESHOLD && (t2.category === "material_cost" || t2.category === "floors" || t2.category === "walls" || t2.category === "fixtures")
  );
  if (risingCosts.length === 0) return null;
  const worst = risingCosts.reduce(
    (max, t2) => (t2.percentChange ?? 0) > (max.percentChange ?? 0) ? t2 : max
  );
  const confidenceScore = CONFIDENCE_WEIGHTS[worst.confidence] ?? 0.4;
  return {
    type: "cost_pressure",
    severity: (worst.percentChange ?? 0) > 20 ? "critical" : "warning",
    title: `Material cost pressure: ${worst.metric} up ${(worst.percentChange ?? 0).toFixed(1)}%`,
    body: null,
    // LLM fills
    actionableRecommendation: null,
    // LLM fills
    confidenceScore,
    triggerCondition: `30-day MA increase > ${COST_PRESSURE_THRESHOLD}% for material cost category`,
    dataPoints: {
      metric: worst.metric,
      category: worst.category,
      percentChange: worst.percentChange,
      currentMA: worst.currentMA,
      previousMA: worst.previousMA,
      risingCategories: risingCosts.map((t2) => t2.metric)
    }
  };
}
function checkMarketOpportunity(input) {
  if (!input.competitorLandscape) return null;
  const { totalDevelopers, hhi, concentration } = input.competitorLandscape;
  if (totalDevelopers >= MARKET_OPPORTUNITY_MIN_COMPETITORS && concentration !== "fragmented") {
    return null;
  }
  const risingTrends = input.trends?.filter((t2) => t2.direction === "rising") ?? [];
  if (totalDevelopers >= MARKET_OPPORTUNITY_MIN_COMPETITORS && risingTrends.length === 0) {
    return null;
  }
  const confidenceScore = input.competitorLandscape ? Math.min(0.85, 0.5 + (MARKET_OPPORTUNITY_MIN_COMPETITORS - totalDevelopers) * 0.15) : 0.4;
  return {
    type: "market_opportunity",
    severity: "info",
    title: `Market opportunity: ${totalDevelopers < MARKET_OPPORTUNITY_MIN_COMPETITORS ? "low competition" : "fragmented market"} detected`,
    body: null,
    actionableRecommendation: null,
    confidenceScore: Math.max(0.2, confidenceScore),
    triggerCondition: `<${MARKET_OPPORTUNITY_MIN_COMPETITORS} competitors in segment OR fragmented market (HHI < 0.15)`,
    dataPoints: {
      totalDevelopers,
      hhi,
      concentration,
      risingTrends: risingTrends.map((t2) => t2.metric)
    }
  };
}
function checkCompetitorAlert(input) {
  if (!input.competitorLandscape) return null;
  const highThreats = input.competitorLandscape.topDevelopers.filter(
    (d) => d.threatLevel === "high"
  );
  if (highThreats.length === 0) return null;
  const topThreat = highThreats[0];
  const confidenceScore = 0.75;
  return {
    type: "competitor_alert",
    severity: highThreats.length >= 3 ? "critical" : "warning",
    title: `Competitor alert: ${topThreat.developerName} holds ${(topThreat.marketShareByUnits * 100).toFixed(1)}% market share`,
    body: null,
    actionableRecommendation: null,
    confidenceScore,
    triggerCondition: `Developer with >15% market share detected`,
    dataPoints: {
      topThreat: topThreat.developerName,
      marketShare: topThreat.marketShareByUnits,
      highThreatCount: highThreats.length,
      allHighThreats: highThreats.map((d) => ({
        name: d.developerName,
        share: d.marketShareByUnits
      }))
    }
  };
}
function checkTrendSignal(input) {
  if (!input.trends) return null;
  const significantTrends = input.trends.filter(
    (t2) => t2.direction !== "stable" && t2.direction !== "insufficient_data" && t2.percentChange !== null && Math.abs(t2.percentChange) > TREND_SIGNAL_MIN_CHANGE
  );
  if (significantTrends.length === 0) return null;
  const most = significantTrends.reduce(
    (max, t2) => Math.abs(t2.percentChange ?? 0) > Math.abs(max.percentChange ?? 0) ? t2 : max
  );
  const confidenceScore = CONFIDENCE_WEIGHTS[most.confidence] ?? 0.4;
  return {
    type: "trend_signal",
    severity: Math.abs(most.percentChange ?? 0) > 15 ? "warning" : "info",
    title: `Trend signal: ${most.metric} ${most.direction} by ${Math.abs(most.percentChange ?? 0).toFixed(1)}%`,
    body: null,
    actionableRecommendation: null,
    confidenceScore,
    triggerCondition: `Trend direction change > ${TREND_SIGNAL_MIN_CHANGE}% detected`,
    dataPoints: {
      metric: most.metric,
      direction: most.direction,
      percentChange: most.percentChange,
      anomalyCount: most.anomalyCount,
      totalSignificantTrends: significantTrends.length
    }
  };
}
function checkPositioningGap(input) {
  if (!input.marketPosition) return null;
  const { percentile, targetValue, percentiles, tier } = input.marketPosition;
  if (percentile >= POSITIONING_GAP_PERCENTILE_LOW && percentile <= POSITIONING_GAP_PERCENTILE_HIGH) {
    return null;
  }
  const isBelow = percentile < POSITIONING_GAP_PERCENTILE_LOW;
  const confidenceScore = 0.7;
  return {
    type: "positioning_gap",
    severity: isBelow ? "info" : "warning",
    title: `Positioning gap: project at P${Math.round(percentile)} (${isBelow ? "below" : "above"} market range)`,
    body: null,
    actionableRecommendation: null,
    confidenceScore,
    triggerCondition: `Project percentile outside P${POSITIONING_GAP_PERCENTILE_LOW}-P${POSITIONING_GAP_PERCENTILE_HIGH} range`,
    dataPoints: {
      targetValue,
      percentile,
      tier,
      p25: percentiles.p25,
      p50: percentiles.p50,
      p75: percentiles.p75,
      gapToP25: targetValue - percentiles.p25,
      gapToP75: targetValue - percentiles.p75
    }
  };
}
async function enrichWithLLM(insight) {
  const prompt = `You are a UAE real estate analytics advisor. Generate a brief insight body and actionable recommendation.

Insight Type: ${insight.type}
Title: ${insight.title}
Severity: ${insight.severity}
Trigger: ${insight.triggerCondition}
Data: ${JSON.stringify(insight.dataPoints)}

Output JSON:
{
  "body": "2-3 sentence analysis explaining the insight and its implications",
  "recommendation": "1-2 sentence specific actionable recommendation"
}

Rules:
- Be specific, use numbers from the data
- Body should explain WHY this matters for the project
- Recommendation should be concrete and actionable
- Keep total under 100 words`;
  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: "You are a concise UAE real estate analytics advisor. Output valid JSON only." },
        { role: "user", content: prompt }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "insight_enrichment",
          strict: true,
          schema: {
            type: "object",
            properties: {
              body: { type: "string", description: "2-3 sentence analysis" },
              recommendation: { type: "string", description: "1-2 sentence recommendation" }
            },
            required: ["body", "recommendation"],
            additionalProperties: false
          }
        }
      }
    });
    const content = response.choices?.[0]?.message?.content;
    if (typeof content === "string") {
      const parsed = JSON.parse(content);
      insight.body = parsed.body || null;
      insight.actionableRecommendation = parsed.recommendation || null;
    }
  } catch {
    insight.body = `${insight.title}. This was detected based on: ${insight.triggerCondition}.`;
    insight.actionableRecommendation = "Review the underlying data and adjust project parameters accordingly.";
  }
  return insight;
}
async function generateInsights(input, options = {}) {
  const { enrichWithLLM: shouldEnrich = true } = options;
  const checks = [
    checkCostPressure(input),
    checkMarketOpportunity(input),
    checkCompetitorAlert(input),
    checkTrendSignal(input),
    checkPositioningGap(input)
  ];
  const insights = checks.filter((i) => i !== null);
  if (shouldEnrich) {
    for (let i = 0; i < insights.length; i++) {
      insights[i] = await enrichWithLLM(insights[i]);
    }
  }
  const severityOrder = {
    critical: 0,
    warning: 1,
    info: 2
  };
  insights.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
  return insights;
}

// server/engines/autonomous/alert-engine.ts
import { eq as eq3, inArray as inArray2, and as and2, sql as sql2 } from "drizzle-orm";
async function evaluateAlerts(params) {
  const db = await getDb();
  if (!db) return [];
  const newAlerts = [];
  for (const event of params.priceChangeEvents) {
    if (event.severity === "significant") {
      newAlerts.push({
        alertType: "price_shock",
        severity: "critical",
        title: "Significant Price Shock Detected",
        body: `The price of ${event.itemName} shifted by ${event.changePct}%`,
        affectedProjectIds: [],
        affectedCategories: [event.category],
        triggerData: event,
        suggestedAction: "Review material cost dependencies and update affected budgets.",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1e3)
        // critical: 24h
      });
    }
  }
  let loadedPatterns = {};
  if (params.patternMatches.length > 0) {
    const pIds = params.patternMatches.map((m) => m.patternId);
    const patterns = await db.select().from(decisionPatterns).where(inArray2(decisionPatterns.id, pIds));
    for (const p of patterns) loadedPatterns[p.id] = p;
  }
  let loadedProjects = {};
  if (params.patternMatches.length > 0) {
    const prjIds = params.patternMatches.map((m) => m.projectId);
    const prjs = await db.select().from(projects).where(inArray2(projects.id, prjIds));
    for (const p of prjs) loadedProjects[p.id] = p;
  }
  for (const match of params.patternMatches) {
    const pattern = loadedPatterns[match.patternId];
    const project = loadedProjects[match.projectId];
    if (!pattern || !project) continue;
    if (pattern.category === "risk_indicator" && parseFloat(pattern.reliabilityScore || "1") < 0.4) {
      newAlerts.push({
        alertType: "pattern_warning",
        severity: "high",
        title: "High-Risk Pattern Matched",
        body: `Project '${project.name}' matched risk pattern '${pattern.name}' (Historical success rate <40%).`,
        affectedProjectIds: [match.projectId],
        affectedCategories: [],
        triggerData: { match, pattern },
        suggestedAction: "Implement strict preventative measures immediately.",
        expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1e3)
        // high: 72h
      });
    }
  }
  if (params.accuracyLedger && parseFloat(params.accuracyLedger.overallPlatformAccuracy || "100") < 60) {
    newAlerts.push({
      alertType: "accuracy_degraded",
      severity: "high",
      title: "Platform Accuracy Degraded",
      body: `Overall platform prediction accuracy dropped to ${params.accuracyLedger.overallPlatformAccuracy}%.`,
      affectedProjectIds: [],
      affectedCategories: [],
      triggerData: params.accuracyLedger,
      suggestedAction: "Audit V5 learning weights and calibration multipliers.",
      expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1e3)
    });
  }
  if (params.calibrationProposals && params.calibrationProposals.length > 0) {
    for (const prop of params.calibrationProposals) {
      if (parseFloat(prop.calibrationFactor || "0") > 0.15) {
        newAlerts.push({
          alertType: "benchmark_drift",
          severity: "medium",
          title: "Benchmark Calibration Drift",
          body: `A benchmark proposal requires >15% drift adjustment (${prop.calibrationFactor}).`,
          affectedProjectIds: prop.projectId ? [prop.projectId] : [],
          affectedCategories: [],
          triggerData: prop,
          suggestedAction: "Review calibration proposals and update material baseline bands.",
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1e3)
          // medium: 7d
        });
      }
    }
  }
  for (const insight of params.projectInsights) {
    if (insight.insightType === "market_opportunity" && (insight.severity === "critical" || insight.severity === "warning")) {
      newAlerts.push({
        alertType: "market_opportunity",
        severity: "medium",
        title: "Market Opportunity Identified",
        body: insight.title,
        affectedProjectIds: insight.projectId ? [insight.projectId] : [],
        affectedCategories: [],
        triggerData: insight,
        suggestedAction: insight.actionableRecommendation || "Investigate the newly generated opportunity parameters.",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1e3)
      });
    }
  }
  const insertedAlerts = [];
  for (const alert of newAlerts) {
    const existing = await db.select().from(platformAlerts).where(
      and2(
        eq3(platformAlerts.alertType, alert.alertType),
        eq3(platformAlerts.status, "active")
        // For perfect duplicate suppression on JSON array, we can use simple string equality or fetch and filter
        // We'll fetch active of this type and filter by JS equality
      )
    );
    const isDuplicate2 = existing.some(
      (e) => JSON.stringify(e.affectedProjectIds) === JSON.stringify(alert.affectedProjectIds)
    );
    if (!isDuplicate2) {
      const [result] = await db.insert(platformAlerts).values(alert);
      insertedAlerts.push({ ...alert, id: result.insertId });
    }
  }
  return insertedAlerts;
}
async function triggerAlertEngine() {
  const db = await getDb();
  if (!db) return [];
  const memoryWindow = new Date(Date.now() - 24 * 60 * 60 * 1e3);
  const recentPrices = await db.select().from(priceChangeEvents).where(sql2`${priceChangeEvents.detectedAt} >= ${memoryWindow}`);
  const recentInsights = await db.select().from(projectInsights).where(sql2`${projectInsights.createdAt} >= ${memoryWindow}`);
  const recentComparisons = await db.select().from(outcomeComparisons).orderBy(sql2`${outcomeComparisons.comparedAt} DESC`).limit(20);
  const recentMatches = await db.select().from(projectPatternMatches).where(sql2`${projectPatternMatches.matchedAt} >= ${memoryWindow}`);
  const ledgerRows = await db.select().from(accuracySnapshots).orderBy(sql2`${accuracySnapshots.snapshotDate} DESC`).limit(1);
  const recentProposals = await db.select().from(benchmarkProposals).where(sql2`${benchmarkProposals.createdAt} >= ${memoryWindow}`);
  return evaluateAlerts({
    priceChangeEvents: recentPrices,
    projectInsights: recentInsights,
    outcomeComparisons: recentComparisons,
    patternMatches: recentMatches,
    accuracyLedger: ledgerRows[0],
    calibrationProposals: recentProposals
  });
}

// server/engines/autonomous/document-generator.ts
init_llm();
import { eq as eq4, desc as desc2 } from "drizzle-orm";
async function generateAutonomousDesignBrief(projectId) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const [project] = await db.select().from(projects).where(eq4(projects.id, projectId));
  if (!project) throw new Error("Project not found");
  const scoreRecords = await db.select().from(scoreMatrices).where(eq4(scoreMatrices.projectId, projectId)).orderBy(desc2(scoreMatrices.computedAt)).limit(1);
  const scores = scoreRecords[0] || null;
  const systemPrompt = `
You are an expert real estate development consultant and interior design strategist for MIYAR.
Write a comprehensive "Design Brief" document based on the provided project data and scores.

The output MUST be presented in well - structured Markdown, containing:
1. Executive Summary
2. Strategic Positioning
3. Key Risks & Mitigations
4. Architectural & Interior Guidelines
5. 5 - Lens Assessment(if scores are available)

Make the tone professional, persuasive, and highly analytical.

Project Context:
- Name: ${project.name}
- Typology: ${project.ctx01Typology}
- Tier: ${project.mkt01Tier}
- Location: ${project.ctx04Location}
- Horizon: ${project.ctx05Horizon}

${scores ? `
Latest Evaluation Scores:
- Composite Score: ${scores.compositeScore}
- Risk Level: ${scores.riskScore}
- Confidence: ${scores.confidenceScore}
- Strategic Alignment: ${scores.saScore}
- Financial Feasibility: ${scores.ffScore}
- Market Positioning: ${scores.mpScore}
- Design & Sustainability: ${scores.dsScore}
- Execution Risk: ${scores.erScore}
` : "No evaluation scores generated yet."}
`;
  const response = await invokeLLM({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: "Please generate the comprehensive design brief." }
    ]
  });
  const content = response.choices?.[0]?.message?.content;
  const markdownOutput = typeof content === "string" ? content : Array.isArray(content) ? content.map((c) => c.text || "").join("") : "";
  return markdownOutput.trim();
}

// server/routers/project.ts
async function buildEvalConfig(modelVersion, expectedCost, benchmarkCount, overrideRate = 0) {
  const baseWeights = modelVersion.dimensionWeights;
  const publishedLogic = await getPublishedLogicVersion();
  let dimensionWeights = baseWeights;
  if (publishedLogic) {
    const logicWeightRows = await getLogicWeights(publishedLogic.id);
    if (logicWeightRows.length > 0) {
      const logicWeightsMap = {};
      for (const w of logicWeightRows) {
        logicWeightsMap[w.dimension] = parseFloat(w.weight);
      }
      if (Object.keys(logicWeightsMap).length >= 5) {
        dimensionWeights = logicWeightsMap;
      }
    }
  }
  return {
    dimensionWeights,
    variableWeights: modelVersion.variableWeights,
    penaltyConfig: modelVersion.penaltyConfig,
    expectedCost,
    benchmarkCount,
    overrideRate
  };
}
var projectInputSchema = z3.object({
  name: z3.string().min(1).max(255),
  description: z3.string().optional(),
  ctx01Typology: z3.enum(["Residential", "Mixed-use", "Hospitality", "Office"]).default("Residential"),
  ctx02Scale: z3.enum(["Small", "Medium", "Large"]).default("Medium"),
  ctx03Gfa: z3.number().nullable().optional(),
  ctx04Location: z3.enum(["Prime", "Secondary", "Emerging"]).default("Secondary"),
  ctx05Horizon: z3.enum(["0-12m", "12-24m", "24-36m", "36m+"]).default("12-24m"),
  str01BrandClarity: z3.number().min(1).max(5).default(3),
  str02Differentiation: z3.number().min(1).max(5).default(3),
  str03BuyerMaturity: z3.number().min(1).max(5).default(3),
  mkt01Tier: z3.enum(["Mid", "Upper-mid", "Luxury", "Ultra-luxury"]).default("Upper-mid"),
  mkt02Competitor: z3.number().min(1).max(5).default(3),
  mkt03Trend: z3.number().min(1).max(5).default(3),
  fin01BudgetCap: z3.number().nullable().optional(),
  fin02Flexibility: z3.number().min(1).max(5).default(3),
  fin03ShockTolerance: z3.number().min(1).max(5).default(3),
  fin04SalesPremium: z3.number().min(1).max(5).default(3),
  des01Style: z3.enum(["Modern", "Contemporary", "Minimal", "Classic", "Fusion", "Other"]).default("Modern"),
  des02MaterialLevel: z3.number().min(1).max(5).default(3),
  des03Complexity: z3.number().min(1).max(5).default(3),
  des04Experience: z3.number().min(1).max(5).default(3),
  des05Sustainability: z3.number().min(1).max(5).default(2),
  exe01SupplyChain: z3.number().min(1).max(5).default(3),
  exe02Contractor: z3.number().min(1).max(5).default(3),
  exe03Approvals: z3.number().min(1).max(5).default(2),
  exe04QaMaturity: z3.number().min(1).max(5).default(3),
  add01SampleKit: z3.boolean().default(false),
  add02PortfolioMode: z3.boolean().default(false),
  add03DashboardExport: z3.boolean().default(true)
});
function projectToInputs(p) {
  return {
    ctx01Typology: p.ctx01Typology ?? "Residential",
    ctx02Scale: p.ctx02Scale ?? "Medium",
    ctx03Gfa: p.ctx03Gfa ? Number(p.ctx03Gfa) : null,
    ctx04Location: p.ctx04Location ?? "Secondary",
    ctx05Horizon: p.ctx05Horizon ?? "12-24m",
    str01BrandClarity: p.str01BrandClarity ?? 3,
    str02Differentiation: p.str02Differentiation ?? 3,
    str03BuyerMaturity: p.str03BuyerMaturity ?? 3,
    mkt01Tier: p.mkt01Tier ?? "Upper-mid",
    mkt02Competitor: p.mkt02Competitor ?? 3,
    mkt03Trend: p.mkt03Trend ?? 3,
    fin01BudgetCap: p.fin01BudgetCap ? Number(p.fin01BudgetCap) : null,
    fin02Flexibility: p.fin02Flexibility ?? 3,
    fin03ShockTolerance: p.fin03ShockTolerance ?? 3,
    fin04SalesPremium: p.fin04SalesPremium ?? 3,
    des01Style: p.des01Style ?? "Modern",
    des02MaterialLevel: p.des02MaterialLevel ?? 3,
    des03Complexity: p.des03Complexity ?? 3,
    des04Experience: p.des04Experience ?? 3,
    des05Sustainability: p.des05Sustainability ?? 2,
    exe01SupplyChain: p.exe01SupplyChain ?? 3,
    exe02Contractor: p.exe02Contractor ?? 3,
    exe03Approvals: p.exe03Approvals ?? 2,
    exe04QaMaturity: p.exe04QaMaturity ?? 3,
    add01SampleKit: p.add01SampleKit ?? false,
    add02PortfolioMode: p.add02PortfolioMode ?? false,
    add03DashboardExport: p.add03DashboardExport ?? true
  };
}
var projectRouter = router({
  list: orgProcedure.query(async ({ ctx }) => {
    return getProjectsByOrg(ctx.orgId);
  }),
  listWithScores: orgProcedure.query(async ({ ctx }) => {
    const projectList = await getProjectsByOrg(ctx.orgId);
    const result = await Promise.all(
      projectList.map(async (p) => {
        const scores = await getScoreMatricesByProject(p.id);
        const latest = scores.length > 0 ? scores[0] : null;
        return {
          ...p,
          latestScore: latest ? {
            compositeScore: Number(latest.compositeScore),
            rasScore: Number(latest.rasScore),
            confidenceScore: Number(latest.confidenceScore),
            decisionStatus: latest.decisionStatus,
            computedAt: latest.computedAt
          } : null
        };
      })
    );
    return result;
  }),
  get: orgProcedure.input(z3.object({ id: z3.number() })).query(async ({ ctx, input }) => {
    const project = await getProjectById(input.id);
    if (!project || project.orgId !== ctx.orgId && project.userId !== ctx.user.id) return null;
    return project;
  }),
  create: orgProcedure.input(projectInputSchema).mutation(async ({ ctx, input }) => {
    const result = await createProject({
      ...input,
      userId: ctx.user.id,
      orgId: ctx.orgId,
      status: "draft",
      ctx03Gfa: input.ctx03Gfa ? String(input.ctx03Gfa) : null,
      fin01BudgetCap: input.fin01BudgetCap ? String(input.fin01BudgetCap) : null
    });
    await createAuditLog({
      userId: ctx.user.id,
      action: "project.create",
      entityType: "project",
      entityId: result.id
    });
    dispatchWebhook("project.created", { projectId: result.id, name: input.name, tier: input.mkt01Tier }).catch(() => {
    });
    return result;
  }),
  update: orgProcedure.input(z3.object({ id: z3.number() }).merge(projectInputSchema.partial())).mutation(async ({ ctx, input }) => {
    const { id, ...data } = input;
    const project = await getProjectById(id);
    if (!project || project.orgId !== ctx.orgId && project.userId !== ctx.user.id) {
      throw new Error("Project not found");
    }
    if (project.status === "locked") {
      throw new Error("Cannot update a locked project");
    }
    const updateData = { ...data };
    if (data.ctx03Gfa !== void 0) updateData.ctx03Gfa = data.ctx03Gfa ? String(data.ctx03Gfa) : null;
    if (data.fin01BudgetCap !== void 0) updateData.fin01BudgetCap = data.fin01BudgetCap ? String(data.fin01BudgetCap) : null;
    await updateProject(id, updateData);
    await createAuditLog({
      userId: ctx.user.id,
      action: "project.update",
      entityType: "project",
      entityId: id,
      details: data
    });
    return { success: true };
  }),
  delete: protectedProcedure.input(z3.object({ id: z3.number() })).mutation(async ({ ctx, input }) => {
    const project = await getProjectById(input.id);
    if (!project || project.userId !== ctx.user.id) {
      throw new Error("Project not found");
    }
    await deleteProject(input.id);
    await createAuditLog({
      userId: ctx.user.id,
      action: "project.delete",
      entityType: "project",
      entityId: input.id
    });
    return { success: true };
  }),
  evaluate: orgProcedure.input(z3.object({ id: z3.number() })).mutation(async ({ ctx, input }) => {
    const project = await getProjectById(input.id);
    if (!project || project.orgId !== ctx.orgId && project.userId !== ctx.user.id) {
      throw new Error("Project not found");
    }
    const modelVersion = await getActiveModelVersion();
    if (!modelVersion) throw new Error("No active model version found");
    const inputs = projectToInputs(project);
    const expectedCost = await getExpectedCost(
      inputs.ctx01Typology,
      inputs.ctx04Location,
      inputs.mkt01Tier
    );
    const benchmarks = await getBenchmarks(
      inputs.ctx01Typology,
      inputs.ctx04Location,
      inputs.mkt01Tier
    );
    const evidenceRecords2 = await listEvidenceRecords({ projectId: input.id, limit: 500 });
    const budgetFitMethod = evidenceRecords2.length >= 20 ? "evidence_backed" : "benchmark_static";
    const config = await buildEvalConfig(modelVersion, expectedCost, benchmarks.length);
    const scoreResult = evaluate(inputs, config);
    const activeBV = await getActiveBenchmarkVersion();
    const matrixResult = await createScoreMatrix({
      projectId: input.id,
      modelVersionId: modelVersion.id,
      benchmarkVersionId: activeBV?.id ?? null,
      saScore: String(scoreResult.dimensions.sa),
      ffScore: String(scoreResult.dimensions.ff),
      mpScore: String(scoreResult.dimensions.mp),
      dsScore: String(scoreResult.dimensions.ds),
      erScore: String(scoreResult.dimensions.er),
      compositeScore: String(scoreResult.compositeScore),
      riskScore: String(scoreResult.riskScore),
      rasScore: String(scoreResult.rasScore),
      confidenceScore: String(scoreResult.confidenceScore),
      decisionStatus: scoreResult.decisionStatus,
      penalties: scoreResult.penalties,
      riskFlags: scoreResult.riskFlags,
      dimensionWeights: scoreResult.dimensionWeights,
      variableContributions: scoreResult.variableContributions,
      conditionalActions: scoreResult.conditionalActions,
      inputSnapshot: scoreResult.inputSnapshot,
      budgetFitMethod
    });
    try {
      const allBenchmarks = await getAllBenchmarkData();
      const allScores = await getAllScoreMatrices();
      const latestMatrix = await getScoreMatrixById(matrixResult.id);
      if (latestMatrix) {
        const derived = computeDerivedFeatures(project, latestMatrix, allBenchmarks, allScores);
        await createProjectIntelligence({
          projectId: input.id,
          scoreMatrixId: matrixResult.id,
          benchmarkVersionId: activeBV?.id ?? null,
          costDeltaVsBenchmark: String(derived.costDeltaVsBenchmark),
          uniquenessIndex: String(derived.uniquenessIndex),
          feasibilityFlags: derived.feasibilityFlags,
          reworkRiskIndex: String(derived.reworkRiskIndex),
          procurementComplexity: String(derived.procurementComplexity),
          tierPercentile: String(derived.tierPercentile),
          styleFamily: derived.styleFamily,
          costBand: derived.costBand
        });
      }
    } catch (e) {
      console.warn("[Intelligence] Failed to compute derived features:", e);
    }
    await updateProject(input.id, {
      status: "evaluated",
      modelVersionId: modelVersion.id,
      benchmarkVersionId: activeBV?.id ?? null
    });
    await createAuditLog({
      userId: ctx.user.id,
      action: "project.evaluate",
      entityType: "score_matrix",
      entityId: matrixResult.id,
      details: { compositeScore: scoreResult.compositeScore, decisionStatus: scoreResult.decisionStatus },
      benchmarkVersionId: activeBV?.id
    });
    dispatchWebhook("project.evaluated", {
      projectId: input.id,
      name: project.name,
      compositeScore: scoreResult.compositeScore,
      decisionStatus: scoreResult.decisionStatus,
      riskScore: scoreResult.riskScore
    }).catch(() => {
    });
    try {
      const trendSnaps = await getTrendSnapshots({ limit: 50 });
      const trends = trendSnaps.map((s) => ({
        metric: s.metric,
        category: s.category,
        direction: s.direction || "stable",
        percentChange: s.percentChange ? parseFloat(String(s.percentChange)) : null,
        confidence: s.confidence || "low",
        currentMA: s.currentMA ? parseFloat(String(s.currentMA)) : null,
        previousMA: s.previousMA ? parseFloat(String(s.previousMA)) : null,
        anomalyCount: s.anomalyCount || 0
      }));
      const insightInput = {
        trends,
        projectContext: {
          projectId: input.id,
          projectName: project.name || `Project #${input.id}`,
          segment: project.segment,
          geography: project.location
        }
      };
      const insights = await generateInsights(insightInput, { enrichWithLLM: true });
      for (const insight of insights) {
        await insertProjectInsight({
          projectId: input.id,
          insightType: insight.type,
          severity: insight.severity,
          title: insight.title,
          body: insight.body,
          actionableRecommendation: insight.actionableRecommendation,
          confidenceScore: String(insight.confidenceScore),
          triggerCondition: insight.triggerCondition,
          dataPoints: insight.dataPoints
        });
      }
      console.log(`[V3-09] Generated ${insights.length} insights for project ${input.id}`);
    } catch (e) {
      console.warn("[V3-09] Insight generation failed (non-blocking):", e);
    }
    try {
      const alerts = await triggerAlertEngine();
      console.log(`[Project] Post-evaluation alert generation: ${alerts.length} new alerts created`);
    } catch (err) {
      console.error("[Project] Post-evaluation alert generation failed:", err);
    }
    return { scoreMatrixId: matrixResult.id, ...scoreResult };
  }),
  getScores: orgProcedure.input(z3.object({ projectId: z3.number() })).query(async ({ ctx, input }) => {
    const project = await getProjectById(input.projectId);
    if (!project || project.orgId !== ctx.orgId && project.userId !== ctx.user.id) return [];
    return getScoreMatricesByProject(input.projectId);
  }),
  sensitivity: orgProcedure.input(z3.object({ id: z3.number() })).query(async ({ ctx, input }) => {
    const project = await getProjectById(input.id);
    if (!project || project.userId !== ctx.user.id) return [];
    const modelVersion = await getActiveModelVersion();
    if (!modelVersion) return [];
    const inputs = projectToInputs(project);
    const expectedCost = await getExpectedCost(inputs.ctx01Typology, inputs.ctx04Location, inputs.mkt01Tier);
    const benchmarks = await getBenchmarks(inputs.ctx01Typology, inputs.ctx04Location, inputs.mkt01Tier);
    const config = await buildEvalConfig(modelVersion, expectedCost, benchmarks.length);
    return runSensitivityAnalysis(inputs, config);
  }),
  // ─── V2: ROI Narrative Engine ──────────────────────────────────────
  roi: orgProcedure.input(z3.object({ projectId: z3.number() })).query(async ({ ctx, input }) => {
    const project = await getProjectById(input.projectId);
    if (!project || project.orgId !== ctx.orgId && project.userId !== ctx.user.id) return null;
    const scores = await getScoreMatricesByProject(input.projectId);
    if (scores.length === 0) return null;
    const latest = scores[0];
    const roiConfig = await getActiveRoiConfig();
    const coefficients = roiConfig ? {
      hourlyRate: Number(roiConfig.hourlyRate),
      reworkCostPct: Number(roiConfig.reworkCostPct),
      tenderIterationCost: Number(roiConfig.tenderIterationCost),
      designCycleCost: Number(roiConfig.designCycleCost),
      budgetVarianceMultiplier: Number(roiConfig.budgetVarianceMultiplier),
      timeAccelerationWeeks: roiConfig.timeAccelerationWeeks ?? 6,
      conservativeMultiplier: Number(roiConfig.conservativeMultiplier),
      aggressiveMultiplier: Number(roiConfig.aggressiveMultiplier)
    } : void 0;
    const roiInputs = {
      compositeScore: Number(latest.compositeScore),
      riskScore: Number(latest.riskScore),
      confidenceScore: Number(latest.confidenceScore),
      budgetCap: Number(project.fin01BudgetCap || 0),
      gfa: Number(project.ctx03Gfa || 0),
      complexity: project.des03Complexity || 3,
      materialLevel: project.des02MaterialLevel || 3,
      tier: project.mkt01Tier || "Upper-mid",
      horizon: project.ctx05Horizon || "12-24m"
    };
    return computeRoi(roiInputs, coefficients);
  }),
  // ─── V2: 5-Lens Validation Framework ──────────────────────────────
  fiveLens: orgProcedure.input(z3.object({ projectId: z3.number() })).query(async ({ ctx, input }) => {
    const project = await getProjectById(input.projectId);
    if (!project || project.orgId !== ctx.orgId && project.userId !== ctx.user.id) return null;
    const scores = await getScoreMatricesByProject(input.projectId);
    if (scores.length === 0) return null;
    const latest = scores[0];
    const benchmarks = await getAllBenchmarkData();
    return computeFiveLens(project, latest, benchmarks);
  }),
  // ─── V2: Project Intelligence ─────────────────────────────────────
  intelligence: orgProcedure.input(z3.object({ projectId: z3.number() })).query(async ({ ctx, input }) => {
    const project = await getProjectById(input.projectId);
    if (!project || project.orgId !== ctx.orgId && project.userId !== ctx.user.id) return null;
    const intel = await getProjectIntelligenceByProject(input.projectId);
    return intel.length > 0 ? intel[0] : null;
  }),
  // ─── V2: Scenario Templates ───────────────────────────────────────
  scenarioTemplates: orgProcedure.query(async () => {
    return SCENARIO_TEMPLATES;
  }),
  applyScenarioTemplate: orgProcedure.input(z3.object({
    projectId: z3.number(),
    templateKey: z3.string()
  })).mutation(async ({ ctx, input }) => {
    const project = await getProjectById(input.projectId);
    if (!project || project.orgId !== ctx.orgId && project.userId !== ctx.user.id) throw new Error("Project not found");
    const template = getScenarioTemplate(input.templateKey);
    if (!template) throw new Error("Template not found");
    const baseInputs = projectToInputs(project);
    const scenarioInputs2 = { ...baseInputs, ...template.overrides };
    const modelVersion = await getActiveModelVersion();
    if (!modelVersion) throw new Error("No active model version");
    const expectedCost = await getExpectedCost(scenarioInputs2.ctx01Typology, scenarioInputs2.ctx04Location, scenarioInputs2.mkt01Tier);
    const benchmarks = await getBenchmarks(scenarioInputs2.ctx01Typology, scenarioInputs2.ctx04Location, scenarioInputs2.mkt01Tier);
    const config = await buildEvalConfig(modelVersion, expectedCost, benchmarks.length);
    const scoreResult = evaluate(scenarioInputs2, config);
    const result = await createScenarioRecord({
      projectId: input.projectId,
      name: template.name,
      description: template.description,
      variableOverrides: template.overrides,
      isTemplate: true,
      templateKey: input.templateKey
    });
    await createAuditLog({
      userId: ctx.user.id,
      action: "scenario.template_applied",
      entityType: "scenario",
      entityId: result.id,
      details: { templateKey: input.templateKey, score: scoreResult.compositeScore }
    });
    return { id: result.id, ...scoreResult, tradeoffs: template.tradeoffs };
  }),
  // ─── V2: Constraint Solver ────────────────────────────────────────
  solveConstraints: orgProcedure.input(z3.object({
    projectId: z3.number(),
    constraints: z3.array(z3.object({
      variable: z3.string(),
      operator: z3.enum(["eq", "gte", "lte", "in"]),
      value: z3.union([z3.number(), z3.string(), z3.array(z3.union([z3.number(), z3.string()]))])
    }))
  })).mutation(async ({ ctx, input }) => {
    const project = await getProjectById(input.projectId);
    if (!project || project.orgId !== ctx.orgId && project.userId !== ctx.user.id) throw new Error("Project not found");
    const baseProject = projectToInputs(project);
    return solveConstraints(baseProject, input.constraints);
  }),
  // ─── V2: Enhanced Report Generation ───────────────────────────────
  generateReport: orgProcedure.input(z3.object({
    projectId: z3.number(),
    reportType: z3.enum(["validation_summary", "design_brief", "full_report", "autonomous_design_brief"])
  })).mutation(async ({ ctx, input }) => {
    const project = await getProjectById(input.projectId);
    if (!project || project.orgId !== ctx.orgId && project.userId !== ctx.user.id) throw new Error("Project not found");
    const scores = await getScoreMatricesByProject(input.projectId);
    if (scores.length === 0) throw new Error("No scores available. Evaluate first.");
    const latest = scores[0];
    const inputs = projectToInputs(project);
    const modelVersion = await getActiveModelVersion();
    if (!modelVersion) throw new Error("No active model version");
    const expectedCost = await getExpectedCost(inputs.ctx01Typology, inputs.ctx04Location, inputs.mkt01Tier);
    const benchmarks = await getBenchmarks(inputs.ctx01Typology, inputs.ctx04Location, inputs.mkt01Tier);
    const config = await buildEvalConfig(modelVersion, expectedCost, benchmarks.length);
    const scoreResult = {
      dimensions: {
        sa: Number(latest.saScore),
        ff: Number(latest.ffScore),
        mp: Number(latest.mpScore),
        ds: Number(latest.dsScore),
        er: Number(latest.erScore)
      },
      dimensionWeights: latest.dimensionWeights,
      compositeScore: Number(latest.compositeScore),
      riskScore: Number(latest.riskScore),
      rasScore: Number(latest.rasScore),
      confidenceScore: Number(latest.confidenceScore),
      decisionStatus: latest.decisionStatus,
      penalties: latest.penalties ?? [],
      riskFlags: latest.riskFlags ?? [],
      conditionalActions: latest.conditionalActions ?? [],
      variableContributions: latest.variableContributions,
      inputSnapshot: latest.inputSnapshot
    };
    const sensitivity = runSensitivityAnalysis(inputs, config);
    const allBenchmarks = await getAllBenchmarkData();
    const fiveLens = computeFiveLens(project, latest, allBenchmarks);
    const roiConfig = await getActiveRoiConfig();
    const coefficients = roiConfig ? {
      hourlyRate: Number(roiConfig.hourlyRate),
      reworkCostPct: Number(roiConfig.reworkCostPct),
      tenderIterationCost: Number(roiConfig.tenderIterationCost),
      designCycleCost: Number(roiConfig.designCycleCost),
      budgetVarianceMultiplier: Number(roiConfig.budgetVarianceMultiplier),
      timeAccelerationWeeks: roiConfig.timeAccelerationWeeks ?? 6,
      conservativeMultiplier: Number(roiConfig.conservativeMultiplier),
      aggressiveMultiplier: Number(roiConfig.aggressiveMultiplier)
    } : void 0;
    const roiInputs = {
      compositeScore: Number(latest.compositeScore),
      riskScore: Number(latest.riskScore),
      confidenceScore: Number(latest.confidenceScore),
      budgetCap: Number(project.fin01BudgetCap || 0),
      gfa: Number(project.ctx03Gfa || 0),
      complexity: project.des03Complexity || 3,
      materialLevel: project.des02MaterialLevel || 3,
      tier: project.mkt01Tier || "Upper-mid",
      horizon: project.ctx05Horizon || "12-24m"
    };
    const roiResult = computeRoi(roiInputs, coefficients);
    const roi = input.reportType === "full_report" ? computeROI(inputs, scoreResult.compositeScore, 15e4) : void 0;
    let reportData;
    if (input.reportType === "validation_summary") {
      reportData = generateValidationSummary(project.name, project.id, inputs, scoreResult, sensitivity);
    } else if (input.reportType === "design_brief") {
      try {
        const { buildDesignVocabulary: buildDesignVocabulary2 } = await Promise.resolve().then(() => (init_vocabulary(), vocabulary_exports));
        const { buildSpaceProgram: buildSpaceProgram2 } = await Promise.resolve().then(() => (init_space_program(), space_program_exports));
        const { buildFinishSchedule: buildFinishSchedule2 } = await Promise.resolve().then(() => (init_finish_schedule(), finish_schedule_exports));
        const { buildColorPalette: buildColorPalette2 } = await Promise.resolve().then(() => (init_color_palette(), color_palette_exports));
        const { buildRFQPack: buildRFQPack2 } = await Promise.resolve().then(() => (init_rfq_generator(), rfq_generator_exports));
        const { buildDMComplianceChecklist: buildDMComplianceChecklist2 } = await Promise.resolve().then(() => (init_dm_compliance(), dm_compliance_exports));
        const vocab = buildDesignVocabulary2(project);
        const { totalFitoutBudgetAed, rooms, totalAllocatedSqm } = buildSpaceProgram2(project);
        const materials = await getAllMaterials();
        const finishSchedule = buildFinishSchedule2(project, vocab, rooms, materials);
        const colorPalette = await buildColorPalette2(project, vocab);
        const rfqPack = buildRFQPack2(project.id, project.orgId || 1, finishSchedule, rooms, materials);
        const complianceChecklist = buildDMComplianceChecklist2(project.id, project.orgId || 1, project);
        for (const item of finishSchedule) await insertFinishScheduleItem(item);
        await insertProjectColorPalette(colorPalette);
        for (const item of rfqPack) await insertRfqLineItem(item);
        await insertDmComplianceChecklist(complianceChecklist);
        const rfqMin = rfqPack.reduce((acc, r) => acc + Number(r.totalAedMin || 0), 0);
        const rfqMax = rfqPack.reduce((acc, r) => acc + Number(r.totalAedMax || 0), 0);
        await createDesignBrief({
          projectId: project.id,
          version: 1,
          createdBy: ctx.user.id,
          projectIdentity: { name: project.name, location: project.ctx04Location },
          positioningStatement: colorPalette.geminiRationale || "Curated aesthetic alignment.",
          styleMood: colorPalette,
          materialGuidance: { vocab, finishSchedule },
          budgetGuardrails: { totalFitoutBudgetAed, rfqMin, rfqMax, rfqPack },
          procurementConstraints: { rfqMin, rfqMax },
          deliverablesChecklist: complianceChecklist
        });
        console.log(`[V8] Successfully orchestrated Design Intelligence Layer for Project ${project.id}.`);
      } catch (v8Err) {
        console.error("[V8] Engine integration error:", v8Err);
      }
      reportData = generateDesignBrief(project.name, project.id, inputs, scoreResult, sensitivity);
    } else if (input.reportType === "autonomous_design_brief") {
      const mdContent = await generateAutonomousDesignBrief(project.id);
      reportData = {
        reportType: "autonomous_design_brief",
        generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
        projectName: project.name,
        projectId: project.id,
        content: mdContent
      };
    } else {
      reportData = generateFullReport(project.name, project.id, inputs, scoreResult, sensitivity, roi);
    }
    const activeBV = await getActiveBenchmarkVersion();
    const benchmarkVersionTag = activeBV?.versionTag || "v1.0-baseline";
    const publishedLV = await getPublishedLogicVersion();
    const logicVersionTag = publishedLV?.name || "v1.0-default";
    let evidenceRefs = [];
    try {
      const allEvidence = await listEvidenceRecords({ projectId: input.projectId });
      if (allEvidence.length > 0) {
        evidenceRefs = allEvidence.map((e) => ({
          title: e.title || e.itemName,
          sourceUrl: e.sourceUrl || void 0,
          category: e.category || void 0,
          reliabilityGrade: e.reliabilityGrade || void 0,
          captureDate: e.captureDate ? String(e.captureDate) : void 0
        }));
      }
    } catch {
    }
    let boardSummaries = [];
    try {
      const boards = await getMaterialBoardsByProject(input.projectId);
      const { computeBoardSummary: computeBoardSummary2 } = await Promise.resolve().then(() => (init_board_composer(), board_composer_exports));
      for (const board of boards) {
        const boardMaterials = await getMaterialsByBoard(board.id);
        const items = [];
        for (const bm of boardMaterials) {
          const mat = await getMaterialById(bm.materialId);
          if (mat) {
            items.push({
              materialId: mat.id,
              name: mat.name,
              category: mat.category,
              tier: mat.tier,
              costLow: Number(mat.typicalCostLow) || 0,
              costHigh: Number(mat.typicalCostHigh) || 0,
              costUnit: mat.costUnit || "AED/unit",
              leadTimeDays: mat.leadTimeDays || 30,
              leadTimeBand: mat.leadTimeBand || "medium",
              supplierName: mat.supplierName || "TBD"
            });
          }
        }
        if (items.length > 0) {
          boardSummaries.push({ boardName: board.boardName, ...computeBoardSummary2(items) });
        }
      }
    } catch {
    }
    const pdfInput = {
      projectName: project.name,
      projectId: project.id,
      inputs,
      scoreResult,
      sensitivity,
      roi,
      fiveLens,
      roiNarrative: roiResult,
      benchmarkVersion: benchmarkVersionTag,
      logicVersion: logicVersionTag,
      evidenceRefs,
      boardSummaries,
      autonomousContent: input.reportType === "autonomous_design_brief" ? reportData.content : void 0
    };
    const html = generateReportHTML(input.reportType, pdfInput);
    let fileUrl = null;
    try {
      const fileKey = `reports/${project.id}/${input.reportType}-${nanoid(8)}.html`;
      const result = await storagePut(fileKey, html, "text/html");
      fileUrl = result.url;
    } catch (e) {
      console.warn("[Report] S3 upload failed, storing HTML content inline:", e);
    }
    await createReportInstance({
      projectId: input.projectId,
      scoreMatrixId: latest.id,
      reportType: input.reportType,
      fileUrl,
      content: fileUrl ? reportData : { ...reportData, html },
      generatedBy: ctx.user.id,
      benchmarkVersionId: activeBV?.id ?? null
    });
    await createAuditLog({
      userId: ctx.user.id,
      action: "report.generate",
      entityType: "report",
      entityId: input.projectId,
      details: { reportType: input.reportType, fileUrl },
      benchmarkVersionId: activeBV?.id
    });
    dispatchWebhook("report.generated", {
      projectId: input.projectId,
      name: project.name,
      reportType: input.reportType,
      fileUrl,
      compositeScore: scoreResult.compositeScore
    }).catch(() => {
    });
    return {
      ...reportData,
      fileUrl,
      fiveLens: input.reportType === "full_report" ? fiveLens : void 0,
      roiNarrative: input.reportType === "full_report" ? roiResult : void 0
    };
  }),
  listReports: orgProcedure.input(z3.object({ projectId: z3.number() })).query(async ({ ctx, input }) => {
    const project = await getProjectById(input.projectId);
    if (!project || project.orgId !== ctx.orgId && project.userId !== ctx.user.id) return [];
    return getReportsByProject(input.projectId);
  })
});

// server/routers/scenario.ts
import { z as z4 } from "zod";

// server/engines/scenario.ts
function runScenario(baseInputs, scenario, config) {
  const scenarioInputs2 = {
    ...baseInputs,
    ...scenario.variableOverrides
  };
  const scoreResult = evaluate(scenarioInputs2, config);
  return {
    name: scenario.name,
    description: scenario.description,
    scoreResult,
    rasScore: scoreResult.rasScore,
    isDominant: false,
    stabilityScore: 0
  };
}
function runScenarioComparison(baseInputs, scenarios2, config) {
  const results = scenarios2.map((s) => runScenario(baseInputs, s, config));
  let maxRas = -Infinity;
  let dominantIdx = 0;
  results.forEach((r, i) => {
    if (r.rasScore > maxRas) {
      maxRas = r.rasScore;
      dominantIdx = i;
    }
  });
  results.forEach((r, i) => {
    if (i === dominantIdx) {
      r.isDominant = true;
      r.stabilityScore = 100;
    } else {
      const diff = Math.abs(r.rasScore - maxRas);
      r.stabilityScore = Math.max(0, Math.round((1 - diff / 100) * 100 * 100) / 100);
    }
  });
  return results;
}

// server/routers/scenario.ts
function projectToInputs2(p) {
  return {
    ctx01Typology: p.ctx01Typology ?? "Residential",
    ctx02Scale: p.ctx02Scale ?? "Medium",
    ctx03Gfa: p.ctx03Gfa ? Number(p.ctx03Gfa) : null,
    ctx04Location: p.ctx04Location ?? "Secondary",
    ctx05Horizon: p.ctx05Horizon ?? "12-24m",
    str01BrandClarity: p.str01BrandClarity ?? 3,
    str02Differentiation: p.str02Differentiation ?? 3,
    str03BuyerMaturity: p.str03BuyerMaturity ?? 3,
    mkt01Tier: p.mkt01Tier ?? "Upper-mid",
    mkt02Competitor: p.mkt02Competitor ?? 3,
    mkt03Trend: p.mkt03Trend ?? 3,
    fin01BudgetCap: p.fin01BudgetCap ? Number(p.fin01BudgetCap) : null,
    fin02Flexibility: p.fin02Flexibility ?? 3,
    fin03ShockTolerance: p.fin03ShockTolerance ?? 3,
    fin04SalesPremium: p.fin04SalesPremium ?? 3,
    des01Style: p.des01Style ?? "Modern",
    des02MaterialLevel: p.des02MaterialLevel ?? 3,
    des03Complexity: p.des03Complexity ?? 3,
    des04Experience: p.des04Experience ?? 3,
    des05Sustainability: p.des05Sustainability ?? 2,
    exe01SupplyChain: p.exe01SupplyChain ?? 3,
    exe02Contractor: p.exe02Contractor ?? 3,
    exe03Approvals: p.exe03Approvals ?? 2,
    exe04QaMaturity: p.exe04QaMaturity ?? 3,
    add01SampleKit: p.add01SampleKit ?? false,
    add02PortfolioMode: p.add02PortfolioMode ?? false,
    add03DashboardExport: p.add03DashboardExport ?? true
  };
}
var scenarioRouter = router({
  list: protectedProcedure.input(z4.object({ projectId: z4.number() })).query(async ({ ctx, input }) => {
    const project = await getProjectById(input.projectId);
    if (!project || project.userId !== ctx.user.id) return [];
    return getScenariosByProject(input.projectId);
  }),
  create: protectedProcedure.input(z4.object({
    projectId: z4.number(),
    name: z4.string().min(1),
    description: z4.string().optional(),
    variableOverrides: z4.record(z4.string(), z4.any())
  })).mutation(async ({ ctx, input }) => {
    const project = await getProjectById(input.projectId);
    if (!project || project.userId !== ctx.user.id) throw new Error("Project not found");
    const result = await createScenarioRecord({
      projectId: input.projectId,
      name: input.name,
      description: input.description,
      variableOverrides: input.variableOverrides
    });
    await createAuditLog({
      userId: ctx.user.id,
      action: "scenario.create",
      entityType: "scenario",
      entityId: result.id
    });
    return result;
  }),
  delete: protectedProcedure.input(z4.object({ id: z4.number() })).mutation(async ({ ctx, input }) => {
    await deleteScenario(input.id);
    return { success: true };
  }),
  compare: protectedProcedure.input(z4.object({ projectId: z4.number() })).query(async ({ ctx, input }) => {
    const project = await getProjectById(input.projectId);
    if (!project || project.userId !== ctx.user.id) return [];
    const modelVersion = await getActiveModelVersion();
    if (!modelVersion) return [];
    const baseInputs = projectToInputs2(project);
    const expectedCost = await getExpectedCost(
      baseInputs.ctx01Typology,
      baseInputs.ctx04Location,
      baseInputs.mkt01Tier
    );
    const benchmarks = await getBenchmarks(
      baseInputs.ctx01Typology,
      baseInputs.ctx04Location,
      baseInputs.mkt01Tier
    );
    const config = {
      dimensionWeights: modelVersion.dimensionWeights,
      variableWeights: modelVersion.variableWeights,
      penaltyConfig: modelVersion.penaltyConfig,
      expectedCost,
      benchmarkCount: benchmarks.length,
      overrideRate: 0
    };
    const scenarioRecords = await getScenariosByProject(input.projectId);
    if (scenarioRecords.length === 0) return [];
    const scenarioInputs2 = scenarioRecords.map((s) => ({
      name: s.name,
      description: s.description ?? void 0,
      variableOverrides: s.variableOverrides ?? {}
    }));
    return runScenarioComparison(baseInputs, scenarioInputs2, config);
  })
});

// server/routers/admin.ts
import { z as z5 } from "zod";

// server/engines/portfolio.ts
function computeDistributions(items) {
  const tierBuckets = {};
  for (const item of items) {
    const tier = item.project.mkt01Tier || "Unknown";
    if (!tierBuckets[tier]) tierBuckets[tier] = { count: 0, scores: [] };
    tierBuckets[tier].count++;
    tierBuckets[tier].scores.push(Number(item.scoreMatrix.compositeScore));
  }
  const styleBuckets = {};
  for (const item of items) {
    const style = item.project.des01Style || "Unknown";
    if (!styleBuckets[style]) styleBuckets[style] = { count: 0, scores: [] };
    styleBuckets[style].count++;
    styleBuckets[style].scores.push(Number(item.scoreMatrix.compositeScore));
  }
  const costBands = ["below_market", "market_low", "market_mid", "market_high"];
  const costBuckets = {};
  for (const band of costBands) {
    costBuckets[band] = { count: 0, scores: [] };
  }
  for (const item of items) {
    const band = item.intelligence?.costBand || "market_mid";
    if (!costBuckets[band]) costBuckets[band] = { count: 0, scores: [] };
    costBuckets[band].count++;
    costBuckets[band].scores.push(Number(item.scoreMatrix.compositeScore));
  }
  const riskBuckets = {
    "Low (0-30)": { count: 0, scores: [] },
    "Medium (30-60)": { count: 0, scores: [] },
    "High (60+)": { count: 0, scores: [] }
  };
  for (const item of items) {
    const risk = Number(item.scoreMatrix.riskScore);
    const bucket = risk < 30 ? "Low (0-30)" : risk < 60 ? "Medium (30-60)" : "High (60+)";
    riskBuckets[bucket].count++;
    riskBuckets[bucket].scores.push(Number(item.scoreMatrix.compositeScore));
  }
  const toDistribution = (dimension, buckets) => ({
    dimension,
    buckets: Object.entries(buckets).map(([label, data]) => ({
      label,
      count: data.count,
      avgScore: data.scores.length > 0 ? Math.round(data.scores.reduce((a, b) => a + b, 0) / data.scores.length * 10) / 10 : 0
    }))
  });
  return [
    toDistribution("Market Tier", tierBuckets),
    toDistribution("Design Style", styleBuckets),
    toDistribution("Cost Band", costBuckets),
    toDistribution("Risk Level", riskBuckets)
  ];
}
function computeComplianceHeatmap(items) {
  const dimensions = ["SA", "FF", "MP", "DS", "ER"];
  const tiers = ["Mid", "Upper-mid", "Luxury", "Ultra-luxury"];
  const cells = [];
  for (const tier of tiers) {
    const tierItems = items.filter((i) => i.project.mkt01Tier === tier);
    if (tierItems.length === 0) continue;
    for (const dim of dimensions) {
      const key = `${dim.toLowerCase()}Score`;
      const scores = tierItems.map((i) => Number(i.scoreMatrix[key] || 0));
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      cells.push({
        row: tier,
        col: dim,
        score: Math.round(avg * 10) / 10,
        status: avg >= 70 ? "compliant" : avg >= 50 ? "warning" : "non_compliant",
        projectCount: tierItems.length
      });
    }
  }
  return cells;
}
function detectFailurePatterns(items) {
  const patterns = [];
  const budgetMismatch = items.filter((i) => {
    const budget = Number(i.project.fin01BudgetCap || 0);
    const complexity = i.project.des03Complexity || 3;
    return budget < 300 && complexity >= 4;
  });
  if (budgetMismatch.length > 0) {
    patterns.push({
      pattern: "Budget-Complexity Mismatch",
      description: "Projects with high design complexity but below-market budget caps. This combination frequently leads to value engineering compromises.",
      frequency: budgetMismatch.length,
      severity: "high",
      affectedProjects: budgetMismatch.map((i) => i.project.id)
    });
  }
  const supplyRisk = items.filter((i) => {
    const supply = i.project.exe01SupplyChain || 3;
    const material = i.project.des02MaterialLevel || 3;
    return supply <= 2 && material >= 4;
  });
  if (supplyRisk.length > 0) {
    patterns.push({
      pattern: "Procurement Risk Exposure",
      description: "Premium material specifications paired with low supply chain readiness. High probability of procurement delays and cost overruns.",
      frequency: supplyRisk.length,
      severity: "high",
      affectedProjects: supplyRisk.map((i) => i.project.id)
    });
  }
  const brandGap = items.filter((i) => {
    const brand = i.project.str01BrandClarity || 3;
    const diff = i.project.str02Differentiation || 3;
    return brand <= 2 && diff >= 4;
  });
  if (brandGap.length > 0) {
    patterns.push({
      pattern: "Brand-Differentiation Gap",
      description: "High differentiation ambition without clear brand foundation. Differentiation claims lack credibility without brand clarity.",
      frequency: brandGap.length,
      severity: "medium",
      affectedProjects: brandGap.map((i) => i.project.id)
    });
  }
  const timelinePressure = items.filter((i) => {
    const horizon = i.project.ctx05Horizon;
    const complexity = i.project.des03Complexity || 3;
    return horizon === "0-12m" && complexity >= 3;
  });
  if (timelinePressure.length > 0) {
    patterns.push({
      pattern: "Timeline Compression Risk",
      description: "Short delivery horizon with moderate-to-high complexity. Projects may face quality compromises or deadline overruns.",
      frequency: timelinePressure.length,
      severity: "medium",
      affectedProjects: timelinePressure.map((i) => i.project.id)
    });
  }
  const qaGap = items.filter((i) => {
    const qa = i.project.exe04QaMaturity || 3;
    const exp = i.project.des04Experience || 3;
    return qa <= 2 && exp >= 4;
  });
  if (qaGap.length > 0) {
    patterns.push({
      pattern: "Quality Assurance Gap",
      description: "High experience quality targets with low QA maturity. Risk of delivery not meeting design intent.",
      frequency: qaGap.length,
      severity: "medium",
      affectedProjects: qaGap.map((i) => i.project.id)
    });
  }
  return patterns.sort((a, b) => {
    const sev = { high: 3, medium: 2, low: 1 };
    return sev[b.severity] - sev[a.severity] || b.frequency - a.frequency;
  });
}
function computeImprovementLevers(items) {
  const levers = [];
  const variableAnalysis = {
    str01BrandClarity: { avgValue: 0, lowCount: 0, label: "Brand Clarity", improvement: "Invest in brand strategy workshops and positioning documentation" },
    str02Differentiation: { avgValue: 0, lowCount: 0, label: "Differentiation", improvement: "Develop unique value propositions and design signatures" },
    fin02Flexibility: { avgValue: 0, lowCount: 0, label: "Budget Flexibility", improvement: "Build contingency buffers and value engineering options" },
    fin03ShockTolerance: { avgValue: 0, lowCount: 0, label: "Shock Tolerance", improvement: "Establish fixed-price contracts and hedging strategies" },
    des02MaterialLevel: { avgValue: 0, lowCount: 0, label: "Material Specification", improvement: "Upgrade material palette to match tier expectations" },
    des04Experience: { avgValue: 0, lowCount: 0, label: "Experience Quality", improvement: "Focus on sensory design elements and spatial experience" },
    exe01SupplyChain: { avgValue: 0, lowCount: 0, label: "Supply Chain Readiness", improvement: "Pre-qualify suppliers and establish dual-sourcing" },
    exe02Contractor: { avgValue: 0, lowCount: 0, label: "Contractor Capability", improvement: "Pre-qualify contractors with proven track records" },
    exe04QaMaturity: { avgValue: 0, lowCount: 0, label: "QA Maturity", improvement: "Implement structured QA processes and inspection protocols" },
    des05Sustainability: { avgValue: 0, lowCount: 0, label: "Sustainability", improvement: "Integrate sustainable materials and energy-efficient systems" }
  };
  for (const item of items) {
    for (const [key, analysis] of Object.entries(variableAnalysis)) {
      const val = item.project[key] || 3;
      analysis.avgValue += val;
      if (val <= 2) analysis.lowCount++;
    }
  }
  const n = items.length || 1;
  for (const [key, analysis] of Object.entries(variableAnalysis)) {
    analysis.avgValue /= n;
  }
  const sorted = Object.entries(variableAnalysis).map(([key, a]) => ({
    key,
    ...a,
    potential: (5 - a.avgValue) * 0.6 + a.lowCount / n * 0.4
  })).sort((a, b) => b.potential - a.potential);
  for (let i = 0; i < Math.min(10, sorted.length); i++) {
    const s = sorted[i];
    levers.push({
      rank: i + 1,
      lever: s.label,
      description: s.improvement,
      estimatedImpact: s.avgValue < 2.5 ? "High" : s.avgValue < 3.5 ? "Medium" : "Low",
      applicableProjects: s.lowCount
    });
  }
  return levers;
}

// server/routers/admin.ts
var adminRouter = router({
  // ─── Benchmarks ──────────────────────────────────────────────────────
  benchmarks: router({
    list: protectedProcedure.input(z5.object({
      typology: z5.string().optional(),
      location: z5.string().optional(),
      marketTier: z5.string().optional()
    }).optional()).query(async ({ input }) => {
      return getBenchmarks(input?.typology, input?.location, input?.marketTier);
    }),
    create: adminProcedure.input(z5.object({
      typology: z5.string(),
      location: z5.string(),
      marketTier: z5.string(),
      materialLevel: z5.number(),
      costPerSqftLow: z5.number().optional(),
      costPerSqftMid: z5.number().optional(),
      costPerSqftHigh: z5.number().optional(),
      avgSellingPrice: z5.number().optional(),
      absorptionRate: z5.number().optional(),
      competitiveDensity: z5.number().optional(),
      sourceType: z5.enum(["synthetic", "client_provided", "curated"]).default("synthetic"),
      dataYear: z5.number().optional(),
      region: z5.string().default("UAE"),
      benchmarkVersionId: z5.number().optional()
    })).mutation(async ({ ctx, input }) => {
      const activeBV = await getActiveBenchmarkVersion();
      const result = await createBenchmark({
        ...input,
        benchmarkVersionId: input.benchmarkVersionId ?? activeBV?.id ?? null,
        costPerSqftLow: input.costPerSqftLow ? String(input.costPerSqftLow) : null,
        costPerSqftMid: input.costPerSqftMid ? String(input.costPerSqftMid) : null,
        costPerSqftHigh: input.costPerSqftHigh ? String(input.costPerSqftHigh) : null,
        avgSellingPrice: input.avgSellingPrice ? String(input.avgSellingPrice) : null,
        absorptionRate: input.absorptionRate ? String(input.absorptionRate) : null
      });
      await createAuditLog({
        userId: ctx.user.id,
        action: "benchmark.create",
        entityType: "benchmark",
        entityId: result.id,
        benchmarkVersionId: activeBV?.id
      });
      return result;
    }),
    delete: adminProcedure.input(z5.object({ id: z5.number() })).mutation(async ({ ctx, input }) => {
      await deleteBenchmark(input.id);
      await createAuditLog({
        userId: ctx.user.id,
        action: "benchmark.delete",
        entityType: "benchmark",
        entityId: input.id
      });
      return { success: true };
    }),
    csvImport: adminProcedure.input(z5.object({
      rows: z5.array(z5.object({
        typology: z5.string(),
        location: z5.string(),
        marketTier: z5.string(),
        materialLevel: z5.number(),
        costPerSqftLow: z5.number().optional(),
        costPerSqftMid: z5.number().optional(),
        costPerSqftHigh: z5.number().optional(),
        avgSellingPrice: z5.number().optional(),
        absorptionRate: z5.number().optional(),
        competitiveDensity: z5.number().optional(),
        sourceType: z5.enum(["synthetic", "client_provided", "curated"]).default("client_provided"),
        dataYear: z5.number().optional(),
        region: z5.string().default("UAE")
      }))
    })).mutation(async ({ ctx, input }) => {
      const activeBV = await getActiveBenchmarkVersion();
      let imported = 0;
      for (const row of input.rows) {
        await createBenchmark({
          ...row,
          benchmarkVersionId: activeBV?.id ?? null,
          costPerSqftLow: row.costPerSqftLow ? String(row.costPerSqftLow) : null,
          costPerSqftMid: row.costPerSqftMid ? String(row.costPerSqftMid) : null,
          costPerSqftHigh: row.costPerSqftHigh ? String(row.costPerSqftHigh) : null,
          avgSellingPrice: row.avgSellingPrice ? String(row.avgSellingPrice) : null,
          absorptionRate: row.absorptionRate ? String(row.absorptionRate) : null
        });
        imported++;
      }
      await createAuditLog({
        userId: ctx.user.id,
        action: "benchmark.csv_import",
        entityType: "benchmark",
        details: { rowCount: imported },
        benchmarkVersionId: activeBV?.id
      });
      return { imported };
    })
  }),
  // ─── Benchmark Versions (V2) ────────────────────────────────────────
  benchmarkVersions: router({
    list: adminProcedure.query(async () => {
      return getAllBenchmarkVersions();
    }),
    active: protectedProcedure.query(async () => {
      return getActiveBenchmarkVersion();
    }),
    create: adminProcedure.input(z5.object({
      versionTag: z5.string(),
      description: z5.string().optional()
    })).mutation(async ({ ctx, input }) => {
      const result = await createBenchmarkVersion({
        ...input,
        createdBy: ctx.user.id
      });
      await createAuditLog({
        userId: ctx.user.id,
        action: "benchmark_version.create",
        entityType: "benchmark_version",
        entityId: result.id,
        details: { versionTag: input.versionTag }
      });
      return result;
    }),
    publish: adminProcedure.input(z5.object({ id: z5.number() })).mutation(async ({ ctx, input }) => {
      await publishBenchmarkVersion(input.id, ctx.user.id);
      await createAuditLog({
        userId: ctx.user.id,
        action: "benchmark_version.publish",
        entityType: "benchmark_version",
        entityId: input.id
      });
      return { success: true };
    }),
    diff: adminProcedure.input(z5.object({
      oldVersionId: z5.number(),
      newVersionId: z5.number()
    })).query(async ({ input }) => {
      return getBenchmarkDiff(input.oldVersionId, input.newVersionId);
    }),
    impactPreview: adminProcedure.input(z5.object({ versionId: z5.number() })).query(async ({ input }) => {
      const allScores = await getAllScoreMatrices();
      const currentBV = await getActiveBenchmarkVersion();
      if (!currentBV) return { affectedProjects: [], totalProjects: allScores.length };
      const diff = await getBenchmarkDiff(currentBV.id, input.versionId);
      const totalChanges = diff.added + diff.removed + diff.changed;
      const threshold = 0.1;
      const allBenchmarks = await getAllBenchmarkData();
      const changeRatio = allBenchmarks.length > 0 ? totalChanges / allBenchmarks.length : 0;
      const affected = changeRatio > threshold ? allScores.map((s) => ({ projectId: s.projectId, currentScore: Number(s.compositeScore), estimatedImpact: "may_change" })) : [];
      return { affectedProjects: affected, totalProjects: allScores.length, changeRatio, diff };
    })
  }),
  // ─── Benchmark Categories (V2) ──────────────────────────────────────
  benchmarkCategories: router({
    list: adminProcedure.input(z5.object({
      category: z5.string().optional(),
      projectClass: z5.string().optional()
    }).optional()).query(async ({ input }) => {
      return getAllBenchmarkCategories(input?.category, input?.projectClass);
    }),
    create: adminProcedure.input(z5.object({
      category: z5.enum(["materials", "finishes", "ffe", "procurement", "cost_bands", "tier_definitions", "style_families", "brand_archetypes", "risk_factors", "lead_times"]),
      name: z5.string(),
      description: z5.string().optional(),
      projectClass: z5.enum(["mid", "upper", "luxury", "ultra_luxury"]),
      market: z5.string().default("UAE"),
      submarket: z5.string().default("Dubai"),
      confidenceLevel: z5.enum(["high", "medium", "low"]).default("medium"),
      sourceType: z5.enum(["manual", "admin", "imported", "curated"]).default("admin"),
      data: z5.any()
    })).mutation(async ({ ctx, input }) => {
      const activeBV = await getActiveBenchmarkVersion();
      const result = await createBenchmarkCategory({
        ...input,
        benchmarkVersionId: activeBV?.id ?? null,
        createdBy: ctx.user.id
      });
      await createAuditLog({
        userId: ctx.user.id,
        action: "benchmark_category.create",
        entityType: "benchmark_category",
        entityId: result.id
      });
      return result;
    }),
    update: adminProcedure.input(z5.object({
      id: z5.number(),
      name: z5.string().optional(),
      description: z5.string().optional(),
      data: z5.any().optional(),
      confidenceLevel: z5.enum(["high", "medium", "low"]).optional()
    })).mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      await updateBenchmarkCategory(id, data);
      await createAuditLog({
        userId: ctx.user.id,
        action: "benchmark_category.update",
        entityType: "benchmark_category",
        entityId: id
      });
      return { success: true };
    }),
    delete: adminProcedure.input(z5.object({ id: z5.number() })).mutation(async ({ ctx, input }) => {
      await deleteBenchmarkCategory(input.id);
      await createAuditLog({
        userId: ctx.user.id,
        action: "benchmark_category.delete",
        entityType: "benchmark_category",
        entityId: input.id
      });
      return { success: true };
    })
  }),
  // ─── Model Versions ──────────────────────────────────────────────────
  modelVersions: router({
    list: adminProcedure.query(async () => {
      return getAllModelVersions();
    }),
    create: adminProcedure.input(z5.object({
      versionTag: z5.string(),
      dimensionWeights: z5.any(),
      variableWeights: z5.any(),
      penaltyConfig: z5.any(),
      notes: z5.string().optional()
    })).mutation(async ({ ctx, input }) => {
      const result = await createModelVersion({
        ...input,
        createdBy: ctx.user.id
      });
      await createAuditLog({
        userId: ctx.user.id,
        action: "model_version.create",
        entityType: "model_version",
        entityId: result.id,
        details: { versionTag: input.versionTag }
      });
      return result;
    }),
    active: protectedProcedure.query(async () => {
      return getActiveModelVersion();
    })
  }),
  // ─── ROI Configurations (V2) ────────────────────────────────────────
  roiConfigs: router({
    list: adminProcedure.query(async () => {
      return getAllRoiConfigs();
    }),
    active: protectedProcedure.query(async () => {
      return getActiveRoiConfig();
    }),
    create: adminProcedure.input(z5.object({
      name: z5.string(),
      hourlyRate: z5.number().default(350),
      reworkCostPct: z5.number().default(0.12),
      tenderIterationCost: z5.number().default(25e3),
      designCycleCost: z5.number().default(45e3),
      budgetVarianceMultiplier: z5.number().default(0.08),
      timeAccelerationWeeks: z5.number().default(6),
      conservativeMultiplier: z5.number().default(0.6),
      aggressiveMultiplier: z5.number().default(1.4)
    })).mutation(async ({ ctx, input }) => {
      const result = await createRoiConfig({
        ...input,
        hourlyRate: String(input.hourlyRate),
        reworkCostPct: String(input.reworkCostPct),
        tenderIterationCost: String(input.tenderIterationCost),
        designCycleCost: String(input.designCycleCost),
        budgetVarianceMultiplier: String(input.budgetVarianceMultiplier),
        conservativeMultiplier: String(input.conservativeMultiplier),
        aggressiveMultiplier: String(input.aggressiveMultiplier),
        createdBy: ctx.user.id
      });
      await createAuditLog({
        userId: ctx.user.id,
        action: "roi_config.create",
        entityType: "roi_config",
        entityId: result.id
      });
      return result;
    }),
    update: adminProcedure.input(z5.object({
      id: z5.number(),
      hourlyRate: z5.number().optional(),
      reworkCostPct: z5.number().optional(),
      tenderIterationCost: z5.number().optional(),
      designCycleCost: z5.number().optional(),
      budgetVarianceMultiplier: z5.number().optional(),
      timeAccelerationWeeks: z5.number().optional(),
      conservativeMultiplier: z5.number().optional(),
      aggressiveMultiplier: z5.number().optional()
    })).mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const updateData = {};
      for (const [key, val] of Object.entries(data)) {
        if (val !== void 0) {
          updateData[key] = typeof val === "number" ? String(val) : val;
        }
      }
      await updateRoiConfig(id, updateData);
      await createAuditLog({
        userId: ctx.user.id,
        action: "roi_config.update",
        entityType: "roi_config",
        entityId: id
      });
      return { success: true };
    })
  }),
  // ─── Webhook Configurations (V2) ────────────────────────────────────
  webhooks: router({
    list: adminProcedure.query(async () => {
      return getAllWebhookConfigs();
    }),
    create: adminProcedure.input(z5.object({
      name: z5.string(),
      url: z5.string().url(),
      secret: z5.string().optional(),
      events: z5.array(z5.string()),
      fieldMapping: z5.record(z5.string(), z5.string()).optional()
    })).mutation(async ({ ctx, input }) => {
      const result = await createWebhookConfig({
        ...input,
        createdBy: ctx.user.id
      });
      await createAuditLog({
        userId: ctx.user.id,
        action: "webhook.create",
        entityType: "webhook",
        entityId: result.id
      });
      return result;
    }),
    update: adminProcedure.input(z5.object({
      id: z5.number(),
      name: z5.string().optional(),
      url: z5.string().url().optional(),
      secret: z5.string().optional(),
      events: z5.array(z5.string()).optional(),
      fieldMapping: z5.record(z5.string(), z5.string()).optional(),
      isActive: z5.boolean().optional()
    })).mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      await updateWebhookConfig(id, data);
      await createAuditLog({
        userId: ctx.user.id,
        action: "webhook.update",
        entityType: "webhook",
        entityId: id
      });
      return { success: true };
    }),
    delete: adminProcedure.input(z5.object({ id: z5.number() })).mutation(async ({ ctx, input }) => {
      await deleteWebhookConfig(input.id);
      await createAuditLog({
        userId: ctx.user.id,
        action: "webhook.delete",
        entityType: "webhook",
        entityId: input.id
      });
      return { success: true };
    })
  }),
  // ─── Portfolio Analytics (V2) ───────────────────────────────────────
  portfolio: router({
    overview: adminProcedure.query(async () => {
      const allProjects = await getAllProjects();
      const allScores = await getAllScoreMatrices();
      const allIntel = await getAllProjectIntelligence();
      const latestScoreByProject = /* @__PURE__ */ new Map();
      for (const score of allScores) {
        const existing = latestScoreByProject.get(score.projectId);
        if (!existing || new Date(score.computedAt) > new Date(existing.computedAt)) {
          latestScoreByProject.set(score.projectId, score);
        }
      }
      const intelByProject = /* @__PURE__ */ new Map();
      for (const intel of allIntel) {
        const existing = intelByProject.get(intel.projectId);
        if (!existing || new Date(intel.computedAt) > new Date(existing.computedAt)) {
          intelByProject.set(intel.projectId, intel);
        }
      }
      const portfolioItems = [];
      for (const project of allProjects) {
        const score = latestScoreByProject.get(project.id);
        if (!score) continue;
        const intel = intelByProject.get(project.id);
        portfolioItems.push({
          project,
          scoreMatrix: score,
          intelligence: intel ? {
            costDeltaVsBenchmark: Number(intel.costDeltaVsBenchmark),
            uniquenessIndex: Number(intel.uniquenessIndex),
            feasibilityFlags: intel.feasibilityFlags || [],
            reworkRiskIndex: Number(intel.reworkRiskIndex),
            procurementComplexity: Number(intel.procurementComplexity),
            tierPercentile: Number(intel.tierPercentile),
            styleFamily: intel.styleFamily || "custom",
            costBand: intel.costBand || "market_mid"
          } : void 0
        });
      }
      return {
        totalProjects: allProjects.length,
        scoredProjects: portfolioItems.length,
        distributions: computeDistributions(portfolioItems),
        complianceHeatmap: computeComplianceHeatmap(portfolioItems),
        failurePatterns: detectFailurePatterns(portfolioItems),
        improvementLevers: computeImprovementLevers(portfolioItems),
        projects: portfolioItems.map((p) => ({
          id: p.project.id,
          name: p.project.name,
          tier: p.project.mkt01Tier,
          style: p.project.des01Style,
          compositeScore: Number(p.scoreMatrix.compositeScore),
          riskScore: Number(p.scoreMatrix.riskScore),
          status: p.scoreMatrix.decisionStatus,
          costBand: p.intelligence?.costBand,
          reworkRisk: p.intelligence?.reworkRiskIndex
        }))
      };
    })
  }),
  // ─── Audit Logs ──────────────────────────────────────────────────────
  auditLogs: router({
    list: adminProcedure.input(z5.object({ limit: z5.number().default(50) }).optional()).query(async ({ input }) => {
      return getAuditLogs(input?.limit ?? 50);
    })
  }),
  // ─── Override Records ────────────────────────────────────────────────
  overrides: router({
    list: protectedProcedure.input(z5.object({ projectId: z5.number() })).query(async ({ ctx, input }) => {
      const project = await getProjectById(input.projectId);
      if (!project || project.userId !== ctx.user.id) return [];
      return getOverridesByProject(input.projectId);
    }),
    create: protectedProcedure.input(z5.object({
      projectId: z5.number(),
      overrideType: z5.enum(["strategic", "market_insight", "risk_adjustment", "experimental"]),
      authorityLevel: z5.number().min(1).max(5),
      originalValue: z5.any(),
      overrideValue: z5.any(),
      justification: z5.string().min(10)
    })).mutation(async ({ ctx, input }) => {
      const project = await getProjectById(input.projectId);
      if (!project || project.userId !== ctx.user.id) throw new Error("Project not found");
      const result = await createOverrideRecord({
        ...input,
        userId: ctx.user.id
      });
      await createAuditLog({
        userId: ctx.user.id,
        action: "override.create",
        entityType: "override",
        entityId: result.id,
        details: { overrideType: input.overrideType, projectId: input.projectId }
      });
      return result;
    })
  }),
  // ─── Health Checks ───────────────────────────────────────────────────
  healthCheck: adminProcedure.query(async () => {
    let dbStatus = "offline";
    try {
      const dbInstance = await getDb();
      if (dbInstance) {
        await dbInstance.execute("SELECT 1");
        dbStatus = "online";
      }
    } catch {
      dbStatus = "error";
    }
    const llmStatus = process.env.GEMINI_API_KEY ? "online" : "offline";
    return {
      status: dbStatus === "online" && llmStatus === "online" ? "healthy" : "degraded",
      services: {
        database: dbStatus,
        llm: llmStatus,
        scheduler: "online"
      },
      metrics: {
        memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024,
        // in MB
        uptime: process.uptime()
      }
    };
  })
});

// server/engines/design-brief.ts
var STYLE_MOOD_MAP = {
  Modern: {
    keywords: ["clean lines", "open plan", "minimalist", "functional elegance", "geometric"],
    colors: ["warm white", "charcoal", "natural oak", "matte black", "soft grey"],
    texture: "Smooth surfaces with selective tactile contrast \u2014 polished concrete, matte lacquer, brushed metal",
    lighting: "Layered ambient + task lighting with concealed LED strips and statement pendants",
    spatial: "Open-plan living with defined zones through material transitions rather than walls"
  },
  Contemporary: {
    keywords: ["curated luxury", "refined", "timeless", "sophisticated", "bespoke"],
    colors: ["ivory", "champagne gold", "deep navy", "warm taupe", "bronze"],
    texture: "Rich layering \u2014 marble, silk, velvet, hand-finished metals, natural stone",
    lighting: "Dramatic accent lighting with warm ambient base, sculptural fixtures as focal points",
    spatial: "Generous proportions with intimate conversation areas, seamless indoor-outdoor flow"
  },
  Minimal: {
    keywords: ["essential", "serene", "restrained", "zen", "purposeful"],
    colors: ["pure white", "pale grey", "natural linen", "warm concrete", "muted sage"],
    texture: "Monolithic surfaces \u2014 seamless plaster, raw timber, natural stone with minimal joints",
    lighting: "Diffused natural light maximized, architectural lighting integrated into surfaces",
    spatial: "Uncluttered volumes where each element earns its place, negative space as design tool"
  },
  Classic: {
    keywords: ["heritage", "ornamental", "symmetrical", "grand", "traditional craftsmanship"],
    colors: ["cream", "burgundy", "forest green", "antique gold", "rich walnut"],
    texture: "Ornate plasterwork, carved wood, damask fabrics, polished brass, veined marble",
    lighting: "Chandeliers and sconces with warm incandescent tones, layered drapery for light control",
    spatial: "Formal room hierarchy with enfilade circulation, proportional ceiling heights"
  },
  Fusion: {
    keywords: ["eclectic", "cultural blend", "unexpected pairings", "artisanal", "narrative"],
    colors: ["terracotta", "indigo", "saffron", "olive", "raw umber"],
    texture: "Handcrafted meets industrial \u2014 zellige tiles, raw steel, woven textiles, reclaimed wood",
    lighting: "Mix of artisan pendants, lanterns, and modern track systems",
    spatial: "Layered spaces with cultural references, discovery moments, and curated collections"
  },
  Other: {
    keywords: ["custom", "experimental", "site-specific", "innovative", "boundary-pushing"],
    colors: ["project-specific palette", "contextual response", "material-driven", "site-inspired", "bespoke"],
    texture: "Custom material palette responding to project narrative and site context",
    lighting: "Bespoke lighting design responding to program and spatial character",
    spatial: "Innovative spatial organization driven by project-specific requirements"
  }
};
var TIER_MATERIALS = {
  Mid: {
    primary: ["Engineered stone", "Porcelain tile", "Laminate wood", "Painted MDF"],
    accent: ["Stainless steel", "Glass mosaic", "Vinyl fabric"],
    avoid: ["Natural marble (cost)", "Solid hardwood (budget)", "Custom metalwork"],
    quality: "Good quality commercial-grade materials with consistent finish"
  },
  "Upper-mid": {
    primary: ["Quartz composite", "Large-format porcelain", "Engineered oak", "Lacquered joinery"],
    accent: ["Brushed nickel", "Ceramic tile", "Performance fabric"],
    avoid: ["Ultra-premium stone", "Bespoke furniture", "Exotic hardwoods"],
    quality: "Premium commercial-grade with select residential-quality feature elements"
  },
  Luxury: {
    primary: ["Natural marble", "Solid hardwood", "Custom joinery", "Natural stone"],
    accent: ["Brushed brass", "Silk fabric", "Hand-blown glass", "Leather"],
    avoid: ["Laminate surfaces", "Vinyl", "Standard-grade fixtures"],
    quality: "Residential luxury grade \u2014 hand-selected materials with visible craftsmanship"
  },
  "Ultra-luxury": {
    primary: ["Book-matched marble", "Exotic hardwood", "Bespoke metalwork", "Artisan plaster"],
    accent: ["24k gold leaf", "Murano glass", "Cashmere", "Mother of pearl"],
    avoid: ["Any mass-produced finish", "Standard hardware", "Synthetic materials"],
    quality: "Museum-grade \u2014 one-of-a-kind pieces, master craftsman execution, provenance documented"
  }
};
function generateDesignBrief2(project, inputs, scoreResult) {
  const style = inputs.des01Style || "Modern";
  const tier = inputs.mkt01Tier || "Upper-mid";
  const mood = STYLE_MOOD_MAP[style] || STYLE_MOOD_MAP.Other;
  const materials = TIER_MATERIALS[tier] || TIER_MATERIALS["Upper-mid"];
  const gfa = inputs.ctx03Gfa ? Number(inputs.ctx03Gfa) : null;
  const budget = inputs.fin01BudgetCap ? Number(inputs.fin01BudgetCap) : null;
  let costBand = "Standard";
  if (budget) {
    if (budget > 700) costBand = "Ultra-Premium";
    else if (budget > 450) costBand = "Premium";
    else if (budget > 250) costBand = "Upper-Standard";
  }
  const flexMap = {
    1: "Very tight \u2014 minimal room for specification upgrades",
    2: "Constrained \u2014 value engineering required for any upgrades",
    3: "Moderate \u2014 selective upgrades possible in high-impact areas",
    4: "Flexible \u2014 room for specification enhancements across key areas",
    5: "Open \u2014 full creative freedom within quality parameters"
  };
  const horizonLeadMap = {
    "0-12m": "Aggressive \u2014 prioritize locally stocked materials, minimize custom orders",
    "12-24m": "Standard \u2014 balance between custom and ready-made, plan long-lead items early",
    "24-36m": "Comfortable \u2014 full custom palette available, phase procurement strategically",
    "36m+": "Extended \u2014 opportunity for bespoke commissions and artisan collaborations"
  };
  const sustainNotes = inputs.des05Sustainability >= 4 ? "High sustainability priority \u2014 specify recycled content, low-VOC, FSC-certified wood, local sourcing preferred" : inputs.des05Sustainability >= 3 ? "Moderate sustainability consideration \u2014 prefer eco-friendly options where cost-neutral" : "Standard compliance \u2014 meet local building code requirements for sustainability";
  const positioningParts = [];
  positioningParts.push(`${project.name} is a ${tier.toLowerCase()} ${inputs.ctx01Typology.toLowerCase()} project`);
  positioningParts.push(`positioned in a ${inputs.ctx04Location.toLowerCase()} location`);
  positioningParts.push(`with a ${style.toLowerCase()} design direction`);
  if (scoreResult.decisionStatus === "validated") {
    positioningParts.push(`that has been validated by MIYAR with a composite score of ${scoreResult.compositeScore.toFixed(1)}`);
  } else if (scoreResult.decisionStatus === "conditional") {
    positioningParts.push(`with conditional validation (score: ${scoreResult.compositeScore.toFixed(1)}) \u2014 specific adjustments recommended`);
  } else {
    positioningParts.push(`requiring design direction revision (score: ${scoreResult.compositeScore.toFixed(1)})`);
  }
  const criticalPath = [];
  if (inputs.des02MaterialLevel >= 4) criticalPath.push("Natural stone selection and slab reservation");
  if (inputs.des03Complexity >= 4) criticalPath.push("Custom joinery shop drawings and prototyping");
  if (inputs.des04Experience >= 4) criticalPath.push("Smart home system integration and programming");
  if (tier === "Ultra-luxury") criticalPath.push("Bespoke furniture commissioning");
  if (inputs.exe01SupplyChain <= 2) criticalPath.push("Import logistics for specialty materials");
  if (criticalPath.length === 0) criticalPath.push("Standard procurement timeline applies");
  const importDeps = [];
  if (inputs.des02MaterialLevel >= 4) importDeps.push("Italian marble (8-12 week lead)");
  if (tier === "Luxury" || tier === "Ultra-luxury") importDeps.push("European hardware and fixtures (6-10 weeks)");
  if (inputs.des03Complexity >= 4) importDeps.push("Custom lighting from European manufacturers (10-14 weeks)");
  if (importDeps.length === 0) importDeps.push("Primarily local/regional sourcing feasible");
  const riskMits = [];
  if (inputs.exe01SupplyChain <= 2) riskMits.push("Pre-order critical materials immediately upon brief approval");
  if (inputs.fin03ShockTolerance <= 2) riskMits.push("Lock material prices with supplier agreements before design freeze");
  riskMits.push("Identify 2-3 alternative materials for each critical specification");
  riskMits.push("Schedule mock-up reviews at 30% and 60% completion milestones");
  const veNotes = [];
  if (inputs.fin02Flexibility <= 2) {
    veNotes.push("Focus premium materials on high-visibility areas (lobby, master suite, kitchen)");
    veNotes.push("Use cost-effective alternatives in secondary spaces (storage, utility, corridors)");
  }
  veNotes.push("Consider material substitution matrix for budget flexibility");
  if (gfa && gfa > 3e5) veNotes.push("Bulk procurement discounts available at this scale \u2014 negotiate early");
  return {
    projectIdentity: {
      projectName: project.name,
      typology: inputs.ctx01Typology,
      scale: inputs.ctx02Scale,
      gfa,
      location: inputs.ctx04Location,
      horizon: inputs.ctx05Horizon,
      marketTier: tier,
      style
    },
    positioningStatement: positioningParts.join(" ") + ".",
    styleMood: {
      primaryStyle: style,
      moodKeywords: mood.keywords,
      colorPalette: mood.colors,
      textureDirection: mood.texture,
      lightingApproach: mood.lighting,
      spatialPhilosophy: mood.spatial
    },
    materialGuidance: {
      tierRecommendation: tier,
      primaryMaterials: materials.primary,
      accentMaterials: materials.accent,
      avoidMaterials: materials.avoid,
      sustainabilityNotes: sustainNotes,
      qualityBenchmark: materials.quality
    },
    budgetGuardrails: {
      costPerSqftTarget: budget ? `${budget} AED/sqft` : "Not specified",
      costBand,
      flexibilityLevel: flexMap[inputs.fin02Flexibility] || flexMap[3],
      contingencyRecommendation: inputs.fin03ShockTolerance <= 2 ? "15-20% contingency recommended" : "10-15% contingency recommended",
      valueEngineeringNotes: veNotes
    },
    procurementConstraints: {
      leadTimeWindow: horizonLeadMap[inputs.ctx05Horizon] || horizonLeadMap["12-24m"],
      criticalPathItems: criticalPath,
      localSourcingPriority: inputs.exe01SupplyChain >= 4 ? "Strong local supply chain \u2014 prioritize regional materials" : "Mixed sourcing \u2014 balance local availability with specification requirements",
      importDependencies: importDeps,
      riskMitigations: riskMits
    },
    deliverablesChecklist: {
      phase1: [
        "Mood board (approved)",
        "Material palette board",
        "Color scheme presentation",
        "Spatial concept diagrams",
        "Budget allocation matrix"
      ],
      phase2: [
        "Detailed material specifications",
        "FF&E schedule with pricing",
        "Lighting design concept",
        "Sample kit assembly",
        "Supplier shortlist with lead times"
      ],
      phase3: [
        "Final specification book",
        "Procurement schedule",
        "Quality control checklist",
        "Installation guidelines",
        "Handover documentation"
      ],
      qualityGates: [
        "Design direction sign-off (before Phase 2)",
        "Material sample approval (before procurement)",
        "Mock-up review (before mass production)",
        "Final walkthrough (before handover)"
      ]
    }
  };
}

// server/routers/seed.ts
init_board_composer();
async function buildEvalConfigForSeed(modelVersion, expectedCost, benchmarkCount) {
  const baseWeights = modelVersion.dimensionWeights;
  const publishedLogic = await getPublishedLogicVersion();
  let dimensionWeights = baseWeights;
  if (publishedLogic) {
    const logicWeightRows = await getLogicWeights(publishedLogic.id);
    if (logicWeightRows.length > 0) {
      const logicWeightsMap = {};
      for (const w of logicWeightRows) {
        logicWeightsMap[w.dimension] = parseFloat(w.weight);
      }
      if (Object.keys(logicWeightsMap).length >= 5) {
        dimensionWeights = logicWeightsMap;
      }
    }
  }
  return {
    dimensionWeights,
    variableWeights: modelVersion.variableWeights,
    penaltyConfig: modelVersion.penaltyConfig,
    expectedCost,
    benchmarkCount,
    overrideRate: 0
  };
}
function projectToInputs3(p) {
  return {
    ctx01Typology: p.ctx01Typology ?? "Residential",
    ctx02Scale: p.ctx02Scale ?? "Medium",
    ctx03Gfa: p.ctx03Gfa ? Number(p.ctx03Gfa) : null,
    ctx04Location: p.ctx04Location ?? "Secondary",
    ctx05Horizon: p.ctx05Horizon ?? "12-24m",
    str01BrandClarity: p.str01BrandClarity ?? 3,
    str02Differentiation: p.str02Differentiation ?? 3,
    str03BuyerMaturity: p.str03BuyerMaturity ?? 3,
    mkt01Tier: p.mkt01Tier ?? "Upper-mid",
    mkt02Competitor: p.mkt02Competitor ?? 3,
    mkt03Trend: p.mkt03Trend ?? 3,
    fin01BudgetCap: p.fin01BudgetCap ? Number(p.fin01BudgetCap) : null,
    fin02Flexibility: p.fin02Flexibility ?? 3,
    fin03ShockTolerance: p.fin03ShockTolerance ?? 3,
    fin04SalesPremium: p.fin04SalesPremium ?? 3,
    des01Style: p.des01Style ?? "Modern",
    des02MaterialLevel: p.des02MaterialLevel ?? 3,
    des03Complexity: p.des03Complexity ?? 3,
    des04Experience: p.des04Experience ?? 3,
    des05Sustainability: p.des05Sustainability ?? 2,
    exe01SupplyChain: p.exe01SupplyChain ?? 3,
    exe02Contractor: p.exe02Contractor ?? 3,
    exe03Approvals: p.exe03Approvals ?? 2,
    exe04QaMaturity: p.exe04QaMaturity ?? 3,
    add01SampleKit: p.add01SampleKit ?? false,
    add02PortfolioMode: p.add02PortfolioMode ?? false,
    add03DashboardExport: p.add03DashboardExport ?? true
  };
}
var SAMPLE_PROJECTS = [
  {
    name: "Al Wasl Residences \u2014 Mid-Market Residential",
    description: "A 350-unit mid-market residential tower in Dubai Marina targeting young professionals and first-time buyers. Modern design with cost-efficient material palette. Developer seeks validation that the interior direction balances market appeal with budget constraints.",
    ctx01Typology: "Residential",
    ctx02Scale: "Large",
    ctx03Gfa: 45e4,
    ctx04Location: "Secondary",
    ctx05Horizon: "12-24m",
    str01BrandClarity: 3,
    str02Differentiation: 3,
    str03BuyerMaturity: 3,
    mkt01Tier: "Mid",
    mkt02Competitor: 4,
    mkt03Trend: 3,
    fin01BudgetCap: 280,
    fin02Flexibility: 2,
    fin03ShockTolerance: 2,
    fin04SalesPremium: 2,
    des01Style: "Modern",
    des02MaterialLevel: 2,
    des03Complexity: 2,
    des04Experience: 3,
    des05Sustainability: 2,
    exe01SupplyChain: 3,
    exe02Contractor: 3,
    exe03Approvals: 3,
    exe04QaMaturity: 3,
    add01SampleKit: false,
    add02PortfolioMode: false,
    add03DashboardExport: true
  },
  {
    name: "One Palm Branded Residences \u2014 Premium Luxury",
    description: "A 45-unit ultra-luxury branded residence on Palm Jumeirah with bespoke interiors by an international design house. High material specification (Italian marble, custom joinery, smart home integration). Developer needs validation that the premium design direction justifies the cost premium and aligns with the ultra-luxury buyer profile.",
    ctx01Typology: "Residential",
    ctx02Scale: "Medium",
    ctx03Gfa: 18e4,
    ctx04Location: "Prime",
    ctx05Horizon: "24-36m",
    str01BrandClarity: 5,
    str02Differentiation: 5,
    str03BuyerMaturity: 5,
    mkt01Tier: "Ultra-luxury",
    mkt02Competitor: 3,
    mkt03Trend: 4,
    fin01BudgetCap: 850,
    fin02Flexibility: 4,
    fin03ShockTolerance: 4,
    fin04SalesPremium: 5,
    des01Style: "Contemporary",
    des02MaterialLevel: 5,
    des03Complexity: 4,
    des04Experience: 5,
    des05Sustainability: 3,
    exe01SupplyChain: 4,
    exe02Contractor: 4,
    exe03Approvals: 3,
    exe04QaMaturity: 4,
    add01SampleKit: true,
    add02PortfolioMode: false,
    add03DashboardExport: true
  }
];
var seedRouter = router({
  seedProjects: protectedProcedure.mutation(async ({ ctx }) => {
    const results = [];
    for (const sample of SAMPLE_PROJECTS) {
      const existing = await getProjectsByUser(ctx.user.id);
      if (existing.some((p) => p.name === sample.name)) {
        continue;
      }
      const projectResult = await createProject({
        ...sample,
        userId: ctx.user.id,
        status: "draft",
        ctx03Gfa: String(sample.ctx03Gfa),
        fin01BudgetCap: String(sample.fin01BudgetCap)
      });
      const projectId = projectResult.id;
      const project = await getProjectById(projectId);
      if (!project) continue;
      const modelVersion = await getActiveModelVersion();
      if (!modelVersion) continue;
      const inputs = projectToInputs3(project);
      const expectedCost = await getExpectedCost(
        inputs.ctx01Typology,
        inputs.ctx04Location,
        inputs.mkt01Tier
      );
      const benchmarks = await getBenchmarks(
        inputs.ctx01Typology,
        inputs.ctx04Location,
        inputs.mkt01Tier
      );
      const config = await buildEvalConfigForSeed(modelVersion, expectedCost, benchmarks.length);
      const scoreResult = evaluate(inputs, config);
      await createScoreMatrix({
        projectId,
        modelVersionId: modelVersion.id,
        saScore: String(scoreResult.dimensions.sa),
        ffScore: String(scoreResult.dimensions.ff),
        mpScore: String(scoreResult.dimensions.mp),
        dsScore: String(scoreResult.dimensions.ds),
        erScore: String(scoreResult.dimensions.er),
        compositeScore: String(scoreResult.compositeScore),
        riskScore: String(scoreResult.riskScore),
        rasScore: String(scoreResult.rasScore),
        confidenceScore: String(scoreResult.confidenceScore),
        decisionStatus: scoreResult.decisionStatus,
        penalties: scoreResult.penalties,
        riskFlags: scoreResult.riskFlags,
        dimensionWeights: scoreResult.dimensionWeights,
        variableContributions: scoreResult.variableContributions,
        conditionalActions: scoreResult.conditionalActions,
        inputSnapshot: scoreResult.inputSnapshot
      });
      await updateProject(projectId, {
        status: "evaluated",
        modelVersionId: modelVersion.id
      });
      try {
        const briefData = generateDesignBrief2(
          { name: project.name, description: project.description },
          inputs,
          {
            compositeScore: scoreResult.compositeScore,
            decisionStatus: scoreResult.decisionStatus,
            dimensions: { ...scoreResult.dimensions }
          }
        );
        await createDesignBrief({
          projectId,
          version: 1,
          projectIdentity: briefData.projectIdentity,
          positioningStatement: briefData.positioningStatement,
          styleMood: briefData.styleMood,
          materialGuidance: briefData.materialGuidance,
          budgetGuardrails: briefData.budgetGuardrails,
          procurementConstraints: briefData.procurementConstraints,
          deliverablesChecklist: briefData.deliverablesChecklist,
          createdBy: ctx.user.id
        });
        const catalog = await getAllMaterials();
        const recommended = recommendMaterials(catalog, inputs.mkt01Tier || "Upper-mid", 8);
        if (recommended.length > 0) {
          const boardResult = await createMaterialBoard({
            projectId,
            boardName: `${sample.name.split("\u2014")[0].trim()} \u2014 Primary Board`,
            boardJson: recommended,
            createdBy: ctx.user.id
          });
          for (const mat of recommended) {
            await addMaterialToBoard({
              boardId: boardResult.id,
              materialId: mat.materialId
            });
          }
        }
        await createComment({
          projectId,
          entityType: "general",
          userId: ctx.user.id,
          content: `Project evaluated with composite score ${scoreResult.compositeScore.toFixed(1)} (${scoreResult.decisionStatus}). Design brief V1 generated. Material board created with ${recommended.length} recommended materials.`
        });
        await createComment({
          projectId,
          entityType: "design_brief",
          userId: ctx.user.id,
          content: `Design brief generated based on ${inputs.des01Style} style direction for ${inputs.mkt01Tier} tier. Positioning statement and material guidance aligned with evaluation results.`
        });
      } catch (e) {
        console.error("V2.8 seed data error:", e);
      }
      try {
        const scenarios2 = await getScenariosByProject(projectId);
        if (scenarios2.length > 0) {
          for (const scenario of scenarios2) {
            const scenarioInputData = {
              scenarioId: scenario.id,
              jsonInput: {
                variableOverrides: scenario.variableOverrides,
                description: scenario.description,
                source: "seed"
              }
            };
            await createScenarioInput(scenarioInputData);
            const scenarioOutputData = {
              scenarioId: scenario.id,
              scoreJson: {
                saScore: Number(scoreResult.dimensions.sa) + (Math.random() * 10 - 5),
                ffScore: Number(scoreResult.dimensions.ff) + (Math.random() * 10 - 5),
                mpScore: Number(scoreResult.dimensions.mp) + (Math.random() * 10 - 5),
                dsScore: Number(scoreResult.dimensions.ds) + (Math.random() * 10 - 5),
                erScore: Number(scoreResult.dimensions.er) + (Math.random() * 10 - 5),
                compositeScore: scoreResult.compositeScore + (Math.random() * 8 - 4)
              },
              roiJson: {
                hoursSaved: Math.round(40 + Math.random() * 80),
                costAvoided: Math.round(5e4 + Math.random() * 2e5),
                budgetAccuracyGain: Math.round(5 + Math.random() * 15)
              }
            };
            await createScenarioOutput(scenarioOutputData);
          }
        }
        await createProjectOutcome({
          projectId,
          procurementActualCosts: {
            flooring: Math.round(2e4 + Math.random() * 8e4),
            fixtures: Math.round(15e3 + Math.random() * 6e4),
            joinery: Math.round(1e4 + Math.random() * 4e4)
          },
          leadTimesActual: {
            flooring: Math.round(45 + Math.random() * 90),
            fixtures: Math.round(30 + Math.random() * 60),
            joinery: Math.round(60 + Math.random() * 120)
          },
          rfqResults: {
            totalBids: Math.round(3 + Math.random() * 5),
            acceptedBid: Math.round(8e4 + Math.random() * 2e5)
          },
          capturedBy: ctx.user.id
        });
      } catch (e) {
        console.error("V2.10-V2.13 seed data error:", e);
      }
      await createAuditLog({
        userId: ctx.user.id,
        action: "seed.project",
        entityType: "project",
        entityId: projectId,
        details: {
          compositeScore: scoreResult.compositeScore,
          decisionStatus: scoreResult.decisionStatus
        }
      });
      results.push({
        projectId,
        name: sample.name,
        compositeScore: scoreResult.compositeScore,
        decisionStatus: scoreResult.decisionStatus
      });
    }
    return {
      seeded: results.length,
      projects: results
    };
  }),
  seedMaterials: protectedProcedure.mutation(async () => {
    const existing = await getAllMaterials();
    if (existing.length > 0) {
      return { seeded: 0, message: "Materials already exist" };
    }
    const MATERIALS = [
      { name: "American Walnut Solid", category: "wood", tier: "luxury", typicalCostLow: "450.00", typicalCostHigh: "800.00", costUnit: "AED/sqm", leadTimeDays: 90, leadTimeBand: "long", supplierName: "Havwoods", notes: "Rich dark tones, premium grain patterns" },
      { name: "Artisan Ceramic Vase", category: "accessory", tier: "premium", typicalCostLow: "800.00", typicalCostHigh: "2500.00", costUnit: "AED/piece", leadTimeDays: 45, leadTimeBand: "medium", supplierName: "Various", notes: "Hand-thrown ceramic, gallery quality" },
      { name: "Belgian Linen Upholstery", category: "fabric", tier: "luxury", typicalCostLow: "180.00", typicalCostHigh: "380.00", costUnit: "AED/m", leadTimeDays: 45, leadTimeBand: "medium", supplierName: "Libeco", notes: "Heavy-weight upholstery linen, 20+ colorways" },
      { name: "Blackened Steel Cladding", category: "metal", tier: "premium", typicalCostLow: "220.00", typicalCostHigh: "450.00", costUnit: "AED/sqm", leadTimeDays: 30, leadTimeBand: "short", supplierName: "SteelArt", notes: "Hot-rolled steel with patina finish" },
      { name: "Brushed Brass Hardware", category: "fixture", tier: "luxury", typicalCostLow: "150.00", typicalCostHigh: "400.00", costUnit: "AED/piece", leadTimeDays: 45, leadTimeBand: "medium", supplierName: "Armac Martin", notes: "Solid brass, hand-finished" },
      { name: "Calacatta Gold Marble", category: "stone", tier: "ultra_luxury", typicalCostLow: "650.00", typicalCostHigh: "1500.00", costUnit: "AED/sqm", leadTimeDays: 80, leadTimeBand: "long", supplierName: "Antolini", notes: "Premium Italian marble, book-matched slabs available" },
      { name: "Crema Marfil Marble", category: "stone", tier: "mid", typicalCostLow: "180.00", typicalCostHigh: "350.00", costUnit: "AED/sqm", leadTimeDays: 45, leadTimeBand: "medium", supplierName: "Various", notes: "Versatile cream-toned marble" },
      { name: "Custom Joinery Unit", category: "furniture", tier: "luxury", typicalCostLow: "3500.00", typicalCostHigh: "12000.00", costUnit: "AED/unit", leadTimeDays: 120, leadTimeBand: "critical", supplierName: "Local Craftsman", notes: "Bespoke built-in cabinetry" },
      { name: "Decorative Acoustic Panel", category: "wallpaper", tier: "premium", typicalCostLow: "200.00", typicalCostHigh: "450.00", costUnit: "AED/sqm", leadTimeDays: 45, leadTimeBand: "medium", supplierName: "BuzzrSpace", notes: "Felt-based acoustic panels, custom colors" },
      { name: "European Oak Engineered", category: "wood", tier: "premium", typicalCostLow: "280.00", typicalCostHigh: "520.00", costUnit: "AED/sqm", leadTimeDays: 60, leadTimeBand: "medium", supplierName: "Havwoods", notes: "Engineered oak, multiple finishes available" },
      { name: "Handmade Zellige Tile", category: "tile", tier: "premium", typicalCostLow: "320.00", typicalCostHigh: "650.00", costUnit: "AED/sqm", leadTimeDays: 60, leadTimeBand: "medium", supplierName: "Emery et Cie", notes: "Moroccan handmade glazed tiles" },
      { name: "Italian Pendant Light", category: "lighting", tier: "luxury", typicalCostLow: "1200.00", typicalCostHigh: "4500.00", costUnit: "AED/piece", leadTimeDays: 75, leadTimeBand: "long", supplierName: "Flos", notes: "Designer pendant, dimmable LED" },
      { name: "Porcelain Large-Format Tile", category: "tile", tier: "mid", typicalCostLow: "120.00", typicalCostHigh: "280.00", costUnit: "AED/sqm", leadTimeDays: 30, leadTimeBand: "short", supplierName: "RAK Ceramics", notes: "120x60cm format, marble-look finishes" },
      { name: "Venetian Plaster", category: "paint", tier: "premium", typicalCostLow: "180.00", typicalCostHigh: "400.00", costUnit: "AED/sqm", leadTimeDays: 14, leadTimeBand: "short", supplierName: "Viero", notes: "Polished plaster, multi-layer application" },
      { name: "Miele Built-in Oven", category: "fixture", tier: "luxury", typicalCostLow: "8000.00", typicalCostHigh: "15000.00", costUnit: "AED/unit", leadTimeDays: 60, leadTimeBand: "medium", supplierName: "Miele", notes: "Built-in pyrolytic oven, TouchControl" },
      { name: "Grohe Rainshower System", category: "fixture", tier: "premium", typicalCostLow: "2500.00", typicalCostHigh: "6000.00", costUnit: "AED/set", leadTimeDays: 30, leadTimeBand: "short", supplierName: "Grohe", notes: "Thermostatic shower system with head rain" },
      { name: "Sheer Linen Curtain", category: "fabric", tier: "mid", typicalCostLow: "80.00", typicalCostHigh: "200.00", costUnit: "AED/m", leadTimeDays: 21, leadTimeBand: "short", supplierName: "Various", notes: "Lightweight linen-blend sheers" },
      { name: "Recycled Glass Mosaic", category: "glass", tier: "premium", typicalCostLow: "350.00", typicalCostHigh: "700.00", costUnit: "AED/sqm", leadTimeDays: 45, leadTimeBand: "medium", supplierName: "Sicis", notes: "Recycled glass mosaic, custom colorways" }
    ];
    let seeded = 0;
    for (const mat of MATERIALS) {
      await createMaterial({
        ...mat,
        regionAvailability: ["UAE", "GCC"],
        isActive: true
      });
      seeded++;
    }
    return { seeded, message: `${seeded} materials seeded` };
  }),
  seedEvidence: protectedProcedure.mutation(async ({ ctx }) => {
    const existing = await listEvidenceRecords({});
    if (existing && existing.length > 0) {
      return { seeded: 0, message: "Evidence records already exist" };
    }
    const now = /* @__PURE__ */ new Date();
    const EVIDENCE = [
      { recordId: "MYR-PE-0001", category: "floors", itemName: "Porcelain Tile 60x120 \u2014 Mid Range", specClass: "Porcelain", priceMin: "120.00", priceTypical: "180.00", priceMax: "280.00", unit: "sqm", publisher: "RAK Ceramics", reliabilityGrade: "A", confidenceScore: 85, sourceUrl: "https://rakceramics.com/uae/products", title: "RAK Ceramics UAE Product Catalog" },
      { recordId: "MYR-PE-0002", category: "floors", itemName: "European Oak Engineered Flooring", specClass: "Engineered Wood", priceMin: "280.00", priceTypical: "400.00", priceMax: "520.00", unit: "sqm", publisher: "Havwoods", reliabilityGrade: "B", confidenceScore: 70, sourceUrl: "https://havwoods.com/ae/products", title: "Havwoods UAE Price Guide" },
      { recordId: "MYR-PE-0003", category: "walls", itemName: "Calacatta Gold Marble \u2014 Book-Matched", specClass: "Natural Stone", priceMin: "650.00", priceTypical: "950.00", priceMax: "1500.00", unit: "sqm", publisher: "Antolini", reliabilityGrade: "B", confidenceScore: 75, sourceUrl: "https://antolini.com/en/materials", title: "Antolini Premium Stone Catalog" },
      { recordId: "MYR-PE-0004", category: "walls", itemName: "Venetian Plaster \u2014 Premium", specClass: "Decorative Plaster", priceMin: "180.00", priceTypical: "280.00", priceMax: "400.00", unit: "sqm", publisher: "Viero", reliabilityGrade: "B", confidenceScore: 70, sourceUrl: "https://vierodecorative.com/products", title: "Viero Decorative Finishes" },
      { recordId: "MYR-PE-0005", category: "joinery", itemName: "Custom Kitchen Cabinetry \u2014 Luxury", specClass: "Bespoke Joinery", priceMin: "3500.00", priceTypical: "7500.00", priceMax: "12000.00", unit: "unit", publisher: "Local Craftsman", reliabilityGrade: "C", confidenceScore: 55, sourceUrl: "https://dubaijoinery.com/pricing", title: "Dubai Joinery Market Report" },
      { recordId: "MYR-PE-0006", category: "lighting", itemName: "Designer Pendant Light \u2014 Italian", specClass: "Decorative Lighting", priceMin: "1200.00", priceTypical: "2800.00", priceMax: "4500.00", unit: "piece", publisher: "Flos", reliabilityGrade: "A", confidenceScore: 90, sourceUrl: "https://flos.com/professional", title: "Flos Professional Catalog" },
      { recordId: "MYR-PE-0007", category: "sanitary", itemName: "Grohe Thermostatic Shower System", specClass: "Bathroom Fixtures", priceMin: "2500.00", priceTypical: "4000.00", priceMax: "6000.00", unit: "set", publisher: "Grohe", reliabilityGrade: "A", confidenceScore: 88, sourceUrl: "https://grohe.ae/bathroom", title: "Grohe UAE Product Range" },
      { recordId: "MYR-PE-0008", category: "kitchen", itemName: "Miele Built-in Appliance Package", specClass: "Kitchen Appliances", priceMin: "25000.00", priceTypical: "45000.00", priceMax: "75000.00", unit: "set", publisher: "Miele", reliabilityGrade: "A", confidenceScore: 92, sourceUrl: "https://miele.ae/domestic/kitchen", title: "Miele UAE Kitchen Systems" },
      { recordId: "MYR-PE-0009", category: "ffe", itemName: "Belgian Linen Upholstery Fabric", specClass: "Upholstery", priceMin: "180.00", priceTypical: "280.00", priceMax: "380.00", unit: "lm", publisher: "Libeco", reliabilityGrade: "B", confidenceScore: 72, sourceUrl: "https://libeco.com/collections", title: "Libeco Fabric Collections" },
      { recordId: "MYR-PE-0010", category: "hardware", itemName: "Brushed Brass Door Hardware Set", specClass: "Architectural Hardware", priceMin: "150.00", priceTypical: "250.00", priceMax: "400.00", unit: "piece", publisher: "Armac Martin", reliabilityGrade: "B", confidenceScore: 68, sourceUrl: "https://armacmartin.co.uk/collections", title: "Armac Martin Hardware" },
      { recordId: "MYR-PE-0011", category: "floors", itemName: "Crema Marfil Marble Floor Tile", specClass: "Natural Stone", priceMin: "180.00", priceTypical: "260.00", priceMax: "350.00", unit: "sqm", publisher: "UAE Stone Traders", reliabilityGrade: "B", confidenceScore: 65, sourceUrl: "https://uaetraders.com/stone", title: "UAE Stone Trading Market" },
      { recordId: "MYR-PE-0012", category: "walls", itemName: "Zellige Handmade Tile \u2014 Morocco", specClass: "Artisan Tile", priceMin: "320.00", priceTypical: "480.00", priceMax: "650.00", unit: "sqm", publisher: "Emery et Cie", reliabilityGrade: "C", confidenceScore: 58, sourceUrl: "https://emeryetcie.com/tiles", title: "Emery et Cie Zellige" },
      { recordId: "MYR-PE-0013", category: "ceilings", itemName: "Acoustic Felt Ceiling Panel", specClass: "Acoustic Treatment", priceMin: "200.00", priceTypical: "320.00", priceMax: "450.00", unit: "sqm", publisher: "BuzzrSpace", reliabilityGrade: "B", confidenceScore: 70, sourceUrl: "https://buzzrspace.com/products", title: "BuzzrSpace Acoustic Solutions" },
      { recordId: "MYR-PE-0014", category: "walls", itemName: "Recycled Glass Mosaic Tile", specClass: "Glass", priceMin: "350.00", priceTypical: "500.00", priceMax: "700.00", unit: "sqm", publisher: "Sicis", reliabilityGrade: "B", confidenceScore: 73, sourceUrl: "https://sicis.com/mosaic", title: "Sicis Mosaic Collections" },
      { recordId: "MYR-PE-0015", category: "floors", itemName: "American Walnut Solid Flooring", specClass: "Solid Wood", priceMin: "450.00", priceTypical: "620.00", priceMax: "800.00", unit: "sqm", publisher: "Havwoods", reliabilityGrade: "B", confidenceScore: 71, sourceUrl: "https://havwoods.com/ae/walnut", title: "Havwoods Walnut Range" }
    ];
    let seeded = 0;
    for (const ev of EVIDENCE) {
      await createEvidenceRecord({
        ...ev,
        captureDate: now,
        currencyOriginal: "AED",
        evidencePhase: "concept",
        createdBy: ctx.user.id
      });
      seeded++;
    }
    return { seeded, message: `${seeded} evidence records seeded` };
  }),
  seedEnrichedData: protectedProcedure.mutation(async ({ ctx }) => {
    const now = /* @__PURE__ */ new Date();
    const ENRICHED_MATERIALS = [
      { name: "Statuario Marble Natural", category: "stone", tier: "ultra_luxury", typicalCostLow: "3200.00", typicalCostHigh: "4500.00", costUnit: "AED/sqm", leadTimeDays: 90, leadTimeBand: "long", supplierName: "Sanipex / Arifeen", notes: "Premium natural Statuario marble with distinct veining" },
      { name: "Calacatta Oro Natural", category: "stone", tier: "luxury", typicalCostLow: "675.00", typicalCostHigh: "950.00", costUnit: "AED/sqm", leadTimeDays: 75, leadTimeBand: "long", supplierName: "Sanipex", notes: "Classic Italian Calacatta Oro marble" },
      { name: "Calacatta Gold Porcelain Big Slab", category: "tile", tier: "premium", typicalCostLow: "550.00", typicalCostHigh: "825.00", costUnit: "AED/sqm", leadTimeDays: 30, leadTimeBand: "short", supplierName: "Tile King", notes: "160x320 cm format, 12mm thickness" },
      { name: "Statuario Porcelain 120x120", category: "tile", tier: "mid", typicalCostLow: "90.00", typicalCostHigh: "130.00", costUnit: "AED/sqm", leadTimeDays: 14, leadTimeBand: "short", supplierName: "Tilesman", notes: "High-quality marble-look porcelain" },
      { name: "European Oak Herringbone", category: "wood", tier: "premium", typicalCostLow: "315.00", typicalCostHigh: "450.00", costUnit: "AED/sqm", leadTimeDays: 45, leadTimeBand: "medium", supplierName: "Floors Dubai", notes: "Natural oak in herringbone pattern" },
      { name: "American Walnut Herringbone", category: "wood", tier: "luxury", typicalCostLow: "380.00", typicalCostHigh: "550.00", costUnit: "AED/sqm", leadTimeDays: 60, leadTimeBand: "medium", supplierName: "Floors Dubai", notes: "Premium walnut in herringbone pattern" },
      { name: "Jotun Fenomastic Wonderwall", category: "paint", tier: "mid", typicalCostLow: "75.00", typicalCostHigh: "85.00", costUnit: "AED/L", leadTimeDays: 2, leadTimeBand: "short", supplierName: "Jotun / ACE", notes: "Durable interior paint with smooth finish" },
      { name: "RAK Bianco Vena High Glossy", category: "tile", tier: "mid", typicalCostLow: "45.00", typicalCostHigh: "65.00", costUnit: "AED/sqm", leadTimeDays: 7, leadTimeBand: "short", supplierName: "RAK Ceramics", notes: "40x80 cm glossy porcelain tile" }
    ];
    let materialsSeeded = 0;
    for (const mat of ENRICHED_MATERIALS) {
      await createMaterial({
        ...mat,
        regionAvailability: ["UAE", "GCC"],
        isActive: true
      });
      materialsSeeded++;
    }
    const ENRICHED_EVIDENCE = [
      { recordId: "MYR-EV-2024-001", category: "floors", itemName: "Statuario A Slab 12mm", specClass: "Natural Stone", priceMin: "620.00", priceTypical: "880.00", priceMax: "1200.00", unit: "sqm", publisher: "Sanipex Group", reliabilityGrade: "A", confidenceScore: 90, sourceUrl: "https://www.sanipexgroup.com", title: "Sanipex Statuario Pricing 2024" },
      { recordId: "MYR-EV-2024-002", category: "floors", itemName: "Oak Distressed Engineered", specClass: "Engineered Wood", priceMin: "185.00", priceTypical: "275.00", priceMax: "350.00", unit: "sqm", publisher: "Floors Dubai", reliabilityGrade: "A", confidenceScore: 85, sourceUrl: "https://www.floorsdubai.com", title: "Floors Dubai Oak Specials" },
      { recordId: "MYR-EV-2024-003", category: "floors", itemName: "RAK 30x60 Bianco Vena", specClass: "Porcelain", priceMin: "22.50", priceTypical: "29.00", priceMax: "45.00", unit: "sqm", publisher: "Plaza Middle East", reliabilityGrade: "A", confidenceScore: 95, sourceUrl: "https://plazamiddleeast.com", title: "RAK Ceramics Price List" },
      { recordId: "MYR-EV-2024-004", category: "floors", itemName: "American Walnut 3-Strip", specClass: "Engineered Wood", priceMin: "172.00", priceTypical: "295.00", priceMax: "400.00", unit: "sqm", publisher: "Floors Dubai", reliabilityGrade: "A", confidenceScore: 88, sourceUrl: "https://www.floorsdubai.com", title: "Walnut Flooring Benchmarks" },
      { recordId: "MYR-EV-2024-005", category: "walls", itemName: "Jotun Fenomastic White 4L", specClass: "Paint", priceMin: "150.00", priceTypical: "190.00", priceMax: "220.00", unit: "unit", publisher: "Noon / Jotun", reliabilityGrade: "A", confidenceScore: 92, sourceUrl: "https://www.noon.com", title: "Jotun Retail Pricing" }
    ];
    let evidenceSeeded = 0;
    for (const ev of ENRICHED_EVIDENCE) {
      await createEvidenceRecord({
        ...ev,
        captureDate: now,
        currencyOriginal: "AED",
        evidencePhase: "concept",
        createdBy: ctx.user.id
      });
      evidenceSeeded++;
    }
    return {
      message: "Enriched data seeded successfully",
      materialsSeeded,
      evidenceSeeded
    };
  })
});

// server/routers/design.ts
import { z as z6 } from "zod";
import { TRPCError as TRPCError4 } from "@trpc/server";

// server/engines/visual-gen.ts
function buildPromptContext(inputs) {
  const materialLevelMap = {
    1: "basic/economy",
    2: "standard/mid-range",
    3: "premium/upper-mid",
    4: "luxury/high-end",
    5: "ultra-luxury/bespoke"
  };
  const locationMap = {
    Prime: "Dubai prime waterfront",
    Secondary: "Dubai urban",
    Emerging: "Dubai emerging district"
  };
  return {
    typology: inputs.ctx01Typology,
    location: locationMap[inputs.ctx04Location] || inputs.ctx04Location,
    style: inputs.des01Style,
    tier: inputs.mkt01Tier,
    materialLevel: materialLevelMap[inputs.des02MaterialLevel] || "premium",
    materialCount: "8",
    accentColor: inputs.des01Style === "Minimal" ? "warm brass" : "deep emerald"
  };
}
function interpolateTemplate(template, context) {
  let result = template;
  for (const [key, value] of Object.entries(context)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
  }
  return result;
}
function generateDefaultPrompt(type, context) {
  switch (type) {
    case "mood":
      return `Create a sophisticated interior design mood board for a ${context.tier} ${context.typology} project in ${context.location}. Design style: ${context.style}. Material level: ${context.materialLevel}. The mood board should convey the project's design direction through carefully curated images of materials, textures, colors, lighting, and spatial arrangements. Professional presentation with clean layout.`;
    case "material_board":
      return `Generate a detailed material and finish board for a ${context.tier} ${context.typology} interior. Style: ${context.style}. Show 8 key material swatches arranged in a professional grid: natural stone, wood flooring, metal hardware, fabric upholstery, wall finish, ceiling treatment, lighting fixture, and accent piece. Each swatch labeled with material name. Clean white background, architectural presentation style.`;
    case "hero":
      return `Create a photorealistic marketing hero image for a ${context.tier} ${context.typology} development in ${context.location}. Show a stunning interior living space with ${context.style} design aesthetic. Natural light streaming through floor-to-ceiling windows. High-end ${context.materialLevel} finishes and designer furniture. Aspirational lifestyle photography, warm color temperature, professional real estate marketing quality.`;
  }
}
function validatePrompt(prompt) {
  if (prompt.length < 20) return { valid: false, reason: "Prompt too short \u2014 minimum 20 characters" };
  if (prompt.length > 2e3) return { valid: false, reason: "Prompt too long \u2014 maximum 2000 characters" };
  const blockedTerms = ["nsfw", "explicit", "violent", "weapon", "gore"];
  const lower = prompt.toLowerCase();
  for (const term of blockedTerms) {
    if (lower.includes(term)) return { valid: false, reason: `Blocked content term detected: ${term}` };
  }
  return { valid: true };
}

// server/routers/design.ts
init_board_composer();

// server/_core/imageGeneration.ts
import { Buffer as Buffer3 } from "buffer";
async function generateImage(options) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured");
  }
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${process.env.GEMINI_API_KEY}`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      instances: [
        {
          prompt: options.prompt
        }
      ],
      parameters: {
        sampleCount: 1
        // Optional parameters you might consider exposing later:
        // aspectRatio: "1:1",
        // outputOptions: { mimeType: "image/png" }
      }
    })
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Image generation request failed (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
    );
  }
  const result = await response.json();
  const base64Data = result.predictions?.[0]?.bytesBase64Encoded;
  if (!base64Data) {
    throw new Error("Gemini Image API returned an invalid response missing base64 bytes");
  }
  const buffer = Buffer3.from(base64Data, "base64");
  const { url } = await storagePut(
    `generated/${Date.now()}.png`,
    buffer,
    "image/png"
  );
  return {
    url
  };
}

// server/engines/docx-brief.ts
import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  Packer,
  ShadingType,
  Header,
  Footer,
  PageNumber
} from "docx";
function heading(text2, level = HeadingLevel.HEADING_1) {
  return new Paragraph({ heading: level, children: [new TextRun({ text: text2, bold: true })] });
}
function bodyText(text2) {
  return new Paragraph({
    spacing: { after: 120 },
    children: [new TextRun({ text: text2, size: 22 })]
  });
}
function bulletItem(text2) {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 60 },
    children: [new TextRun({ text: text2, size: 22 })]
  });
}
function labelValue(label, value) {
  return new Paragraph({
    spacing: { after: 80 },
    children: [
      new TextRun({ text: `${label}: `, bold: true, size: 22 }),
      new TextRun({ text: value, size: 22 })
    ]
  });
}
function spacer() {
  return new Paragraph({ spacing: { after: 200 }, children: [] });
}
function twoColumnTable(rows) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        tableHeader: true,
        children: [
          new TableCell({
            width: { size: 35, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.SOLID, color: "1a3a4a" },
            children: [new Paragraph({ children: [new TextRun({ text: "Parameter", bold: true, color: "ffffff", size: 20 })] })]
          }),
          new TableCell({
            width: { size: 65, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.SOLID, color: "1a3a4a" },
            children: [new Paragraph({ children: [new TextRun({ text: "Value", bold: true, color: "ffffff", size: 20 })] })]
          })
        ]
      }),
      ...rows.map(
        ([k, v], i) => new TableRow({
          children: [
            new TableCell({
              shading: i % 2 === 0 ? { type: ShadingType.SOLID, color: "f0f4f8" } : void 0,
              children: [new Paragraph({ children: [new TextRun({ text: k, size: 20 })] })]
            }),
            new TableCell({
              shading: i % 2 === 0 ? { type: ShadingType.SOLID, color: "f0f4f8" } : void 0,
              children: [new Paragraph({ children: [new TextRun({ text: v, size: 20 })] })]
            })
          ]
        })
      )
    ]
  });
}
async function generateDesignBriefDocx(data) {
  const identity = data.projectIdentity ?? {};
  const styleMood = data.styleMood ?? {};
  const materialGuidance = data.materialGuidance ?? {};
  const budgetGuardrails = data.budgetGuardrails ?? {};
  const procurement = data.procurementConstraints ?? {};
  const deliverables = data.deliverablesChecklist ?? {};
  const projectName = String(data.projectName ?? identity.projectName ?? "MIYAR Project");
  const watermark = `MYR-BRIEF-${Date.now().toString(36)}`;
  const sections = [];
  sections.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 3e3, after: 400 },
      children: [new TextRun({ text: "MIYAR Design Brief", size: 56, bold: true, color: "1a3a4a" })]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [new TextRun({ text: projectName, size: 36, color: "4ecdc4" })]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [new TextRun({ text: `Version ${data.version} \u2014 ${(/* @__PURE__ */ new Date()).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`, size: 22, color: "666666" })]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
      children: [new TextRun({ text: `Document ID: ${watermark}`, size: 18, color: "999999" })]
    }),
    spacer()
  );
  sections.push(heading("1. Project Identity"));
  sections.push(
    twoColumnTable([
      ["Project Name", identity.projectName ?? "\u2014"],
      ["Typology", identity.typology ?? "\u2014"],
      ["Scale", identity.scale ?? "\u2014"],
      ["GFA", identity.gfa ? `${Number(identity.gfa).toLocaleString()} sqft` : "\u2014"],
      ["Location", identity.location ?? "\u2014"],
      ["Delivery Horizon", identity.horizon ?? "\u2014"],
      ["Market Tier", identity.marketTier ?? "\u2014"],
      ["Design Style", identity.style ?? "\u2014"]
    ])
  );
  sections.push(spacer());
  sections.push(heading("2. Positioning Statement"));
  sections.push(bodyText(data.positioningStatement ?? "No positioning statement generated."));
  sections.push(spacer());
  sections.push(heading("3. Style & Mood Direction"));
  sections.push(labelValue("Primary Style", styleMood.primaryStyle ?? "\u2014"));
  if (styleMood.moodKeywords?.length) {
    sections.push(labelValue("Mood Keywords", styleMood.moodKeywords.join(", ")));
  }
  if (styleMood.colorPalette?.length) {
    sections.push(labelValue("Color Palette", styleMood.colorPalette.join(", ")));
  }
  sections.push(labelValue("Texture Direction", styleMood.textureDirection ?? "\u2014"));
  sections.push(labelValue("Lighting Approach", styleMood.lightingApproach ?? "\u2014"));
  sections.push(labelValue("Spatial Philosophy", styleMood.spatialPhilosophy ?? "\u2014"));
  sections.push(spacer());
  sections.push(heading("4. Material Guidance"));
  sections.push(labelValue("Tier Recommendation", materialGuidance.tierRecommendation ?? "\u2014"));
  sections.push(labelValue("Quality Benchmark", materialGuidance.qualityBenchmark ?? "\u2014"));
  if (materialGuidance.primaryMaterials?.length) {
    sections.push(new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: "Primary Materials:", bold: true, size: 22 })] }));
    for (const m of materialGuidance.primaryMaterials) {
      sections.push(bulletItem(m));
    }
  }
  if (materialGuidance.accentMaterials?.length) {
    sections.push(new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: "Accent Materials:", bold: true, size: 22 })] }));
    for (const m of materialGuidance.accentMaterials) {
      sections.push(bulletItem(m));
    }
  }
  if (materialGuidance.avoidMaterials?.length) {
    sections.push(new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: "Materials to Avoid:", bold: true, size: 22, color: "c62828" })] }));
    for (const m of materialGuidance.avoidMaterials) {
      sections.push(bulletItem(m));
    }
  }
  sections.push(labelValue("Sustainability Notes", materialGuidance.sustainabilityNotes ?? "\u2014"));
  sections.push(spacer());
  sections.push(heading("5. Budget Guardrails"));
  sections.push(
    twoColumnTable([
      ["Cost Target", budgetGuardrails.costPerSqftTarget ?? "\u2014"],
      ["Cost Band", budgetGuardrails.costBand ?? "\u2014"],
      ["Contingency", budgetGuardrails.contingencyRecommendation ?? "\u2014"],
      ["Flexibility Level", budgetGuardrails.flexibilityLevel ?? "\u2014"]
    ])
  );
  if (budgetGuardrails.valueEngineeringNotes?.length) {
    sections.push(new Paragraph({ spacing: { before: 200, after: 80 }, children: [new TextRun({ text: "Value Engineering Notes:", bold: true, size: 22 })] }));
    for (const note of budgetGuardrails.valueEngineeringNotes) {
      sections.push(bulletItem(note));
    }
  }
  sections.push(spacer());
  sections.push(heading("6. Procurement Constraints"));
  sections.push(labelValue("Lead Time Window", procurement.leadTimeWindow ?? "\u2014"));
  if (procurement.criticalPathItems?.length) {
    sections.push(new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: "Critical Path Items:", bold: true, size: 22 })] }));
    for (const item of procurement.criticalPathItems) {
      sections.push(bulletItem(item));
    }
  }
  if (procurement.importDependencies?.length) {
    sections.push(new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: "Import Dependencies:", bold: true, size: 22 })] }));
    for (const dep of procurement.importDependencies) {
      sections.push(bulletItem(dep));
    }
  }
  if (procurement.riskMitigations?.length) {
    sections.push(new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: "Risk Mitigations:", bold: true, size: 22 })] }));
    for (const m of procurement.riskMitigations) {
      sections.push(bulletItem(m));
    }
  }
  sections.push(spacer());
  sections.push(heading("7. Deliverables Checklist"));
  const phases = [
    { label: "Phase 1 \u2014 Concept", items: deliverables.phase1 },
    { label: "Phase 2 \u2014 Development", items: deliverables.phase2 },
    { label: "Phase 3 \u2014 Execution", items: deliverables.phase3 }
  ];
  for (const phase of phases) {
    sections.push(heading(phase.label, HeadingLevel.HEADING_2));
    if (phase.items?.length) {
      for (const item of phase.items) {
        sections.push(bulletItem(`\u2610 ${item}`));
      }
    }
  }
  if (deliverables.qualityGates?.length) {
    sections.push(heading("Quality Gates", HeadingLevel.HEADING_2));
    for (let i = 0; i < deliverables.qualityGates.length; i++) {
      sections.push(bulletItem(`Gate ${i + 1}: ${deliverables.qualityGates[i]}`));
    }
  }
  sections.push(spacer());
  sections.push(heading("Important Disclaimer", HeadingLevel.HEADING_2));
  sections.push(
    new Paragraph({
      spacing: { after: 120 },
      children: [
        new TextRun({
          text: "This document is a concept-level assessment generated by the MIYAR Decision Intelligence Platform. ",
          size: 20,
          color: "5D4037"
        }),
        new TextRun({
          text: "All scores, recommendations, and specifications are advisory only and are subject to detailed design, ",
          size: 20,
          color: "5D4037"
        }),
        new TextRun({
          text: "engineering review, and professional validation. Material specifications, cost estimates, and procurement ",
          size: 20,
          color: "5D4037"
        }),
        new TextRun({
          text: "guidance are indicative and must be confirmed through formal tender processes. MIYAR does not warrant the ",
          size: 20,
          color: "5D4037"
        }),
        new TextRun({
          text: "accuracy of third-party benchmark data or market intelligence used in this assessment. This document does ",
          size: 20,
          color: "5D4037"
        }),
        new TextRun({
          text: "not constitute professional design, financial, or legal advice.",
          size: 20,
          color: "5D4037"
        })
      ]
    })
  );
  sections.push(spacer());
  sections.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 400 },
      children: [
        new TextRun({
          text: `MIYAR Decision Intelligence Platform \u2014 Document ID: ${watermark}`,
          size: 16,
          color: "999999",
          italics: true
        })
      ]
    })
  );
  sections.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: "This document is auto-generated and watermarked. Scores are advisory and do not constitute professional design or financial advice.",
          size: 14,
          color: "999999"
        })
      ]
    })
  );
  const doc = new Document({
    creator: "MIYAR Decision Intelligence Platform",
    title: `Design Brief \u2014 ${projectName}`,
    description: `MIYAR Design Brief v${data.version} for ${projectName}`,
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
          }
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [new TextRun({ text: `MIYAR Design Brief \u2014 ${projectName}`, size: 16, color: "999999" })]
              })
            ]
          })
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: "Page ", size: 16, color: "999999" }),
                  new TextRun({ children: [PageNumber.CURRENT], size: 16, color: "999999" }),
                  new TextRun({ text: ` \u2014 ${watermark}`, size: 16, color: "999999" })
                ]
              })
            ]
          })
        },
        children: sections
      }
    ]
  });
  const buffer = await Packer.toBuffer(doc);
  return Buffer.from(buffer);
}

// server/routers/design.ts
import { nanoid as nanoid2 } from "nanoid";
function projectToInputs4(p) {
  return {
    ctx01Typology: p.ctx01Typology ?? "Residential",
    ctx02Scale: p.ctx02Scale ?? "Medium",
    ctx03Gfa: p.ctx03Gfa ? Number(p.ctx03Gfa) : null,
    ctx04Location: p.ctx04Location ?? "Secondary",
    ctx05Horizon: p.ctx05Horizon ?? "12-24m",
    str01BrandClarity: p.str01BrandClarity ?? 3,
    str02Differentiation: p.str02Differentiation ?? 3,
    str03BuyerMaturity: p.str03BuyerMaturity ?? 3,
    mkt01Tier: p.mkt01Tier ?? "Upper-mid",
    mkt02Competitor: p.mkt02Competitor ?? 3,
    mkt03Trend: p.mkt03Trend ?? 3,
    fin01BudgetCap: p.fin01BudgetCap ? Number(p.fin01BudgetCap) : null,
    fin02Flexibility: p.fin02Flexibility ?? 3,
    fin03ShockTolerance: p.fin03ShockTolerance ?? 3,
    fin04SalesPremium: p.fin04SalesPremium ?? 3,
    des01Style: p.des01Style ?? "Modern",
    des02MaterialLevel: p.des02MaterialLevel ?? 3,
    des03Complexity: p.des03Complexity ?? 3,
    des04Experience: p.des04Experience ?? 3,
    des05Sustainability: p.des05Sustainability ?? 2,
    exe01SupplyChain: p.exe01SupplyChain ?? 3,
    exe02Contractor: p.exe02Contractor ?? 3,
    exe03Approvals: p.exe03Approvals ?? 2,
    exe04QaMaturity: p.exe04QaMaturity ?? 3,
    add01SampleKit: p.add01SampleKit ?? false,
    add02PortfolioMode: p.add02PortfolioMode ?? false,
    add03DashboardExport: p.add03DashboardExport ?? true
  };
}
var designRouter = router({
  // ─── Evidence Vault ─────────────────────────────────────────────────────────
  listAssets: protectedProcedure.input(z6.object({ projectId: z6.number(), category: z6.string().optional() })).query(async ({ input }) => {
    return getProjectAssets(input.projectId, input.category);
  }),
  uploadAsset: protectedProcedure.input(z6.object({
    projectId: z6.number(),
    filename: z6.string(),
    mimeType: z6.string(),
    base64Data: z6.string(),
    category: z6.enum(["brief", "brand", "budget", "competitor", "inspiration", "material", "sales", "legal", "mood_image", "material_board", "marketing_hero", "generated", "other"]).default("other"),
    tags: z6.array(z6.string()).optional(),
    notes: z6.string().optional(),
    isClientVisible: z6.boolean().default(true)
  })).mutation(async ({ ctx, input }) => {
    const buffer = Buffer.from(input.base64Data, "base64");
    const suffix = Math.random().toString(36).slice(2, 10);
    const storagePath = `projects/${input.projectId}/assets/${suffix}-${input.filename}`;
    const { url } = await storagePut(storagePath, buffer, input.mimeType);
    const result = await createProjectAsset({
      projectId: input.projectId,
      filename: input.filename,
      mimeType: input.mimeType,
      sizeBytes: buffer.length,
      storagePath,
      storageUrl: url,
      uploadedBy: ctx.user.id,
      category: input.category,
      tags: input.tags || [],
      notes: input.notes,
      isClientVisible: input.isClientVisible
    });
    await createAuditLog({
      userId: ctx.user.id,
      action: "asset.upload",
      entityType: "project_asset",
      entityId: result.id,
      details: { projectId: input.projectId, filename: input.filename, category: input.category }
    });
    return { id: result.id, url };
  }),
  deleteAsset: protectedProcedure.input(z6.object({ assetId: z6.number() })).mutation(async ({ ctx, input }) => {
    const asset = await getProjectAssetById(input.assetId);
    if (!asset) throw new TRPCError4({ code: "NOT_FOUND", message: "Asset not found" });
    await deleteProjectAsset(input.assetId);
    await createAuditLog({
      userId: ctx.user.id,
      action: "asset.delete",
      entityType: "project_asset",
      entityId: input.assetId,
      details: { filename: asset.filename }
    });
    return { success: true };
  }),
  updateAsset: protectedProcedure.input(z6.object({
    assetId: z6.number(),
    category: z6.string().optional(),
    tags: z6.array(z6.string()).optional(),
    notes: z6.string().optional(),
    isClientVisible: z6.boolean().optional()
  })).mutation(async ({ ctx, input }) => {
    const { assetId, ...updates } = input;
    await updateProjectAsset(assetId, updates);
    return { success: true };
  }),
  linkAsset: protectedProcedure.input(z6.object({
    assetId: z6.number(),
    linkType: z6.enum(["evaluation", "report", "scenario", "material_board", "design_brief", "visual"]),
    linkId: z6.number()
  })).mutation(async ({ input }) => {
    return createAssetLink(input);
  }),
  getAssetLinks: protectedProcedure.input(z6.object({ assetId: z6.number() })).query(async ({ input }) => {
    return getAssetLinksByAsset(input.assetId);
  }),
  // ─── Design Brief Generator ─────────────────────────────────────────────────
  generateBrief: protectedProcedure.input(z6.object({ projectId: z6.number(), scenarioId: z6.number().optional() })).mutation(async ({ ctx, input }) => {
    const project = await getProjectById(input.projectId);
    if (!project) throw new TRPCError4({ code: "NOT_FOUND", message: "Project not found" });
    const scores = await getScoreMatricesByProject(input.projectId);
    const latest = scores[0];
    if (!latest) throw new TRPCError4({ code: "PRECONDITION_FAILED", message: "Project must be evaluated first" });
    const inputs = projectToInputs4(project);
    const scoreResult = {
      compositeScore: Number(latest.compositeScore),
      decisionStatus: latest.decisionStatus,
      dimensions: {
        sa: Number(latest.saScore),
        ff: Number(latest.ffScore),
        mp: Number(latest.mpScore),
        ds: Number(latest.dsScore),
        er: Number(latest.erScore)
      }
    };
    const briefData = generateDesignBrief2(
      { name: project.name, description: project.description },
      inputs,
      scoreResult
    );
    const existing = await getDesignBriefsByProject(input.projectId);
    const nextVersion = existing.length > 0 ? existing[0].version + 1 : 1;
    const result = await createDesignBrief({
      projectId: input.projectId,
      scenarioId: input.scenarioId,
      version: nextVersion,
      projectIdentity: briefData.projectIdentity,
      positioningStatement: briefData.positioningStatement,
      styleMood: briefData.styleMood,
      materialGuidance: briefData.materialGuidance,
      budgetGuardrails: briefData.budgetGuardrails,
      procurementConstraints: briefData.procurementConstraints,
      deliverablesChecklist: briefData.deliverablesChecklist,
      createdBy: ctx.user.id
    });
    await createAuditLog({
      userId: ctx.user.id,
      action: "design_brief.generate",
      entityType: "design_brief",
      entityId: result.id,
      details: { projectId: input.projectId, version: nextVersion }
    });
    return { id: result.id, version: nextVersion, data: briefData };
  }),
  listBriefs: protectedProcedure.input(z6.object({ projectId: z6.number() })).query(async ({ input }) => {
    return getDesignBriefsByProject(input.projectId);
  }),
  getBrief: protectedProcedure.input(z6.object({ briefId: z6.number() })).query(async ({ input }) => {
    return getDesignBriefById(input.briefId);
  }),
  getLatestBrief: protectedProcedure.input(z6.object({ projectId: z6.number() })).query(async ({ input }) => {
    return getLatestDesignBrief(input.projectId);
  }),
  exportBriefDocx: protectedProcedure.input(z6.object({ briefId: z6.number() })).mutation(async ({ input }) => {
    const brief = await getDesignBriefById(input.briefId);
    if (!brief) throw new Error("Design brief not found");
    const project = await getProjectById(brief.projectId);
    const docxBuffer = await generateDesignBriefDocx({
      projectIdentity: brief.projectIdentity ?? {},
      positioningStatement: brief.positioningStatement ?? "",
      styleMood: brief.styleMood ?? {},
      materialGuidance: brief.materialGuidance ?? {},
      budgetGuardrails: brief.budgetGuardrails ?? {},
      procurementConstraints: brief.procurementConstraints ?? {},
      deliverablesChecklist: brief.deliverablesChecklist ?? {},
      version: brief.version,
      projectName: project?.name
    });
    const fileKey = `reports/${brief.projectId}/design-brief-v${brief.version}-${nanoid2(8)}.docx`;
    const { url } = await storagePut(fileKey, docxBuffer, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    return { url };
  }),
  // ─── Visual Generation (nano banana) ────────────────────────────────────────
  generateVisual: protectedProcedure.input(z6.object({
    projectId: z6.number(),
    type: z6.enum(["mood", "material_board", "hero"]),
    scenarioId: z6.number().optional(),
    customPrompt: z6.string().optional(),
    templateId: z6.number().optional()
  })).mutation(async ({ ctx, input }) => {
    const project = await getProjectById(input.projectId);
    if (!project) throw new TRPCError4({ code: "NOT_FOUND", message: "Project not found" });
    let inputs = projectToInputs4(project);
    if (input.scenarioId) {
      const scenarioInput = await getScenarioInput(input.scenarioId);
      if (scenarioInput?.jsonInput) {
        const overrides = typeof scenarioInput.jsonInput === "string" ? JSON.parse(scenarioInput.jsonInput) : scenarioInput.jsonInput;
        inputs = { ...inputs, ...overrides };
      }
    }
    const context = buildPromptContext(inputs);
    let prompt;
    if (input.customPrompt) {
      prompt = input.customPrompt;
    } else if (input.templateId) {
      const templates = await getAllPromptTemplates(input.type, ctx.user.orgId ?? void 0);
      const tmpl = templates.find((t2) => t2.id === input.templateId);
      prompt = tmpl ? interpolateTemplate(tmpl.templateText, context) : generateDefaultPrompt(input.type, context);
    } else {
      const tmpl = await getActivePromptTemplate(input.type, ctx.user.orgId ?? void 0);
      prompt = tmpl ? interpolateTemplate(tmpl.templateText, context) : generateDefaultPrompt(input.type, context);
    }
    const validation = validatePrompt(prompt);
    if (!validation.valid) {
      throw new TRPCError4({ code: "BAD_REQUEST", message: validation.reason });
    }
    const visualResult = await createGeneratedVisual({
      projectId: input.projectId,
      scenarioId: input.scenarioId,
      type: input.type,
      promptJson: { prompt, context, templateId: input.templateId },
      status: "generating",
      createdBy: ctx.user.id
    });
    try {
      const { url } = await generateImage({ prompt });
      const assetResult = await createProjectAsset({
        projectId: input.projectId,
        filename: `${input.type}-${Date.now()}.png`,
        mimeType: "image/png",
        sizeBytes: 0,
        storagePath: `projects/${input.projectId}/visuals/${input.type}-${Date.now()}.png`,
        storageUrl: url,
        uploadedBy: ctx.user.id,
        category: input.type === "mood" ? "mood_image" : input.type === "material_board" ? "material_board" : "marketing_hero"
      });
      await updateGeneratedVisual(visualResult.id, {
        status: "completed",
        imageAssetId: assetResult.id
      });
      await createAuditLog({
        userId: ctx.user.id,
        action: "visual.generate",
        entityType: "generated_visual",
        entityId: visualResult.id,
        details: { type: input.type, projectId: input.projectId }
      });
      return { id: visualResult.id, assetId: assetResult.id, url, status: "completed" };
    } catch (error) {
      await updateGeneratedVisual(visualResult.id, {
        status: "failed",
        errorMessage: error.message || "Image generation failed"
      });
      return { id: visualResult.id, assetId: null, url: null, status: "failed", error: error.message };
    }
  }),
  listVisuals: protectedProcedure.input(z6.object({ projectId: z6.number() })).query(async ({ input }) => {
    const visuals = await getGeneratedVisualsByProject(input.projectId);
    const enriched = await Promise.all(visuals.map(async (v) => {
      let imageUrl = null;
      if (v.imageAssetId) {
        const asset = await getProjectAssetById(v.imageAssetId);
        imageUrl = asset?.storageUrl ?? null;
      }
      return { ...v, imageUrl };
    }));
    return enriched;
  }),
  // V4-05: Attach a completed visual's asset to a report/pack as an evidence reference
  attachVisualToPack: protectedProcedure.input(z6.object({
    visualId: z6.number(),
    targetType: z6.enum(["report", "design_brief", "material_board", "pack_section"]),
    targetId: z6.number(),
    sectionLabel: z6.string().optional()
  })).mutation(async ({ ctx, input }) => {
    const visual = await getGeneratedVisualById(input.visualId);
    if (!visual || !visual.imageAssetId) {
      throw new TRPCError4({ code: "NOT_FOUND", message: "Visual not found or has no image" });
    }
    await createEvidenceReference({
      evidenceRecordId: visual.imageAssetId,
      // asset ID as evidence
      targetType: input.targetType,
      targetId: input.targetId,
      sectionLabel: input.sectionLabel || `Visual #${visual.id}`,
      citationText: `AI-generated ${visual.type} visual (prompt: ${(visual.promptJson?.prompt || "").slice(0, 100)}...)`
    });
    await createAuditLog({
      userId: ctx.user.id,
      action: "visual.attach_to_pack",
      entityType: "generated_visual",
      entityId: visual.id,
      details: { targetType: input.targetType, targetId: input.targetId }
    });
    return { success: true };
  }),
  // ─── Material Board Composer ────────────────────────────────────────────────
  createBoard: protectedProcedure.input(z6.object({
    projectId: z6.number(),
    boardName: z6.string(),
    scenarioId: z6.number().optional(),
    materialIds: z6.array(z6.number()).optional()
  })).mutation(async ({ ctx, input }) => {
    const materials = [];
    if (input.materialIds && input.materialIds.length > 0) {
      for (const id of input.materialIds) {
        const mat = await getMaterialById(id);
        if (mat) materials.push(mat);
      }
    }
    const boardResult = await createMaterialBoard({
      projectId: input.projectId,
      scenarioId: input.scenarioId,
      boardName: input.boardName,
      boardJson: materials,
      createdBy: ctx.user.id
    });
    if (input.materialIds) {
      for (const materialId of input.materialIds) {
        await addMaterialToBoard({ boardId: boardResult.id, materialId });
      }
    }
    await createAuditLog({
      userId: ctx.user.id,
      action: "board.create",
      entityType: "material_board",
      entityId: boardResult.id,
      details: { projectId: input.projectId, materialCount: materials.length }
    });
    return { id: boardResult.id };
  }),
  listBoards: protectedProcedure.input(z6.object({ projectId: z6.number() })).query(async ({ input }) => {
    return getMaterialBoardsByProject(input.projectId);
  }),
  getBoard: protectedProcedure.input(z6.object({ boardId: z6.number() })).query(async ({ input }) => {
    const board = await getMaterialBoardById(input.boardId);
    if (!board) throw new TRPCError4({ code: "NOT_FOUND" });
    const boardMaterials = await getMaterialsByBoard(input.boardId);
    const materialDetails = [];
    for (const bm of boardMaterials) {
      const mat = await getMaterialById(bm.materialId);
      if (mat) materialDetails.push({ ...mat, boardJoinId: bm.id, quantity: bm.quantity, unitOfMeasure: bm.unitOfMeasure, boardNotes: bm.notes, sortOrder: bm.sortOrder, specNotes: bm.specNotes, costBandOverride: bm.costBandOverride });
    }
    return { board, materials: materialDetails };
  }),
  addMaterialToBoard: protectedProcedure.input(z6.object({
    boardId: z6.number(),
    materialId: z6.number(),
    quantity: z6.number().optional(),
    unitOfMeasure: z6.string().optional(),
    notes: z6.string().optional()
  })).mutation(async ({ input }) => {
    return addMaterialToBoard({
      boardId: input.boardId,
      materialId: input.materialId,
      quantity: input.quantity ? String(input.quantity) : void 0,
      unitOfMeasure: input.unitOfMeasure,
      notes: input.notes
    });
  }),
  removeMaterialFromBoard: protectedProcedure.input(z6.object({ joinId: z6.number() })).mutation(async ({ input }) => {
    await removeMaterialFromBoard(input.joinId);
    return { success: true };
  }),
  deleteBoard: protectedProcedure.input(z6.object({ boardId: z6.number() })).mutation(async ({ ctx, input }) => {
    await deleteMaterialBoard(input.boardId);
    await createAuditLog({
      userId: ctx.user.id,
      action: "board.delete",
      entityType: "material_board",
      entityId: input.boardId
    });
    return { success: true };
  }),
  updateBoardTile: protectedProcedure.input(z6.object({
    joinId: z6.number(),
    specNotes: z6.string().nullish(),
    costBandOverride: z6.string().nullish(),
    quantity: z6.number().nullish(),
    unitOfMeasure: z6.string().nullish(),
    notes: z6.string().nullish()
  })).mutation(async ({ ctx, input }) => {
    const { joinId, ...rest } = input;
    await updateBoardTile(joinId, {
      specNotes: rest.specNotes ?? void 0,
      costBandOverride: rest.costBandOverride ?? void 0,
      quantity: rest.quantity !== void 0 && rest.quantity !== null ? String(rest.quantity) : void 0,
      unitOfMeasure: rest.unitOfMeasure ?? void 0,
      notes: rest.notes ?? void 0
    });
    return { success: true };
  }),
  reorderBoardTiles: protectedProcedure.input(z6.object({
    boardId: z6.number(),
    orderedJoinIds: z6.array(z6.number())
  })).mutation(async ({ input }) => {
    await reorderBoardTiles(input.boardId, input.orderedJoinIds);
    return { success: true };
  }),
  exportBoardPdf: protectedProcedure.input(z6.object({ boardId: z6.number() })).mutation(async ({ ctx, input }) => {
    const board = await getMaterialBoardById(input.boardId);
    if (!board) throw new TRPCError4({ code: "NOT_FOUND" });
    const project = await getProjectById(board.projectId);
    if (!project) throw new TRPCError4({ code: "NOT_FOUND" });
    const boardMaterials = await getMaterialsByBoard(input.boardId);
    const items = [];
    for (const bm of boardMaterials) {
      const mat = await getMaterialById(bm.materialId);
      if (mat) {
        items.push({
          materialId: mat.id,
          name: mat.name,
          category: mat.category,
          tier: mat.tier,
          costLow: Number(mat.typicalCostLow) || 0,
          costHigh: Number(mat.typicalCostHigh) || 0,
          costUnit: mat.costUnit || "AED/unit",
          leadTimeDays: mat.leadTimeDays || 30,
          leadTimeBand: mat.leadTimeBand || "medium",
          supplierName: mat.supplierName || "TBD",
          specNotes: bm.specNotes || void 0,
          costBandOverride: bm.costBandOverride || void 0,
          quantity: bm.quantity ? String(bm.quantity) : void 0,
          unitOfMeasure: bm.unitOfMeasure || void 0,
          notes: bm.notes || void 0
        });
      }
    }
    const { generateBoardPdfHtml: generateBoardPdfHtml2 } = await Promise.resolve().then(() => (init_board_pdf(), board_pdf_exports));
    const summary = computeBoardSummary(items);
    const rfqLines = generateRfqLines(items);
    const html = generateBoardPdfHtml2({
      boardName: board.boardName,
      projectName: project.name,
      items,
      summary,
      rfqLines
    });
    let fileUrl = null;
    try {
      const fileKey = `boards/${board.projectId}/${board.id}-${nanoid2(8)}.html`;
      const result = await storagePut(fileKey, html, "text/html");
      fileUrl = result.url;
    } catch (e) {
      console.warn("[Board PDF] S3 upload failed:", e);
    }
    await createAuditLog({
      userId: ctx.user.id,
      action: "board.export_pdf",
      entityType: "material_board",
      entityId: input.boardId,
      details: { fileUrl, itemCount: items.length }
    });
    return { fileUrl, html };
  }),
  boardSummary: protectedProcedure.input(z6.object({ boardId: z6.number() })).query(async ({ input }) => {
    const boardMaterials = await getMaterialsByBoard(input.boardId);
    const items = [];
    for (const bm of boardMaterials) {
      const mat = await getMaterialById(bm.materialId);
      if (mat) {
        items.push({
          materialId: mat.id,
          name: mat.name,
          category: mat.category,
          tier: mat.tier,
          costLow: Number(mat.typicalCostLow) || 0,
          costHigh: Number(mat.typicalCostHigh) || 0,
          costUnit: mat.costUnit || "AED/unit",
          leadTimeDays: mat.leadTimeDays || 30,
          leadTimeBand: mat.leadTimeBand || "medium",
          supplierName: mat.supplierName || "TBD"
        });
      }
    }
    return {
      summary: computeBoardSummary(items),
      rfqLines: generateRfqLines(items)
    };
  }),
  recommendMaterials: protectedProcedure.input(z6.object({ projectId: z6.number(), maxItems: z6.number().default(10) })).query(async ({ input }) => {
    const project = await getProjectById(input.projectId);
    if (!project) throw new TRPCError4({ code: "NOT_FOUND" });
    const catalog = await getAllMaterials();
    return recommendMaterials(catalog, project.mkt01Tier || "Upper-mid", input.maxItems);
  }),
  // ─── Materials Catalog ──────────────────────────────────────────────────────
  listMaterials: protectedProcedure.input(z6.object({ category: z6.string().optional(), tier: z6.string().optional() })).query(async ({ input }) => {
    return getAllMaterials(input.category, input.tier);
  }),
  getMaterial: protectedProcedure.input(z6.object({ id: z6.number() })).query(async ({ input }) => {
    return getMaterialById(input.id);
  }),
  createMaterial: adminProcedure.input(z6.object({
    name: z6.string(),
    category: z6.enum(["tile", "stone", "wood", "metal", "fabric", "glass", "paint", "wallpaper", "lighting", "furniture", "fixture", "accessory", "other"]),
    tier: z6.enum(["economy", "mid", "premium", "luxury", "ultra_luxury"]),
    typicalCostLow: z6.number().optional(),
    typicalCostHigh: z6.number().optional(),
    costUnit: z6.string().default("AED/sqm"),
    leadTimeDays: z6.number().optional(),
    leadTimeBand: z6.enum(["short", "medium", "long", "critical"]).default("medium"),
    regionAvailability: z6.array(z6.string()).optional(),
    supplierName: z6.string().optional(),
    supplierContact: z6.string().optional(),
    supplierUrl: z6.string().optional(),
    notes: z6.string().optional()
  })).mutation(async ({ ctx, input }) => {
    const result = await createMaterial({
      ...input,
      typicalCostLow: input.typicalCostLow ? String(input.typicalCostLow) : void 0,
      typicalCostHigh: input.typicalCostHigh ? String(input.typicalCostHigh) : void 0,
      createdBy: ctx.user.id
    });
    return result;
  }),
  updateMaterial: adminProcedure.input(z6.object({
    id: z6.number(),
    name: z6.string().optional(),
    typicalCostLow: z6.number().optional(),
    typicalCostHigh: z6.number().optional(),
    leadTimeDays: z6.number().optional(),
    supplierName: z6.string().optional(),
    notes: z6.string().optional()
  })).mutation(async ({ input }) => {
    const { id, ...updates } = input;
    const mapped = { ...updates };
    if (updates.typicalCostLow !== void 0) mapped.typicalCostLow = String(updates.typicalCostLow);
    if (updates.typicalCostHigh !== void 0) mapped.typicalCostHigh = String(updates.typicalCostHigh);
    await updateMaterial(id, mapped);
    return { success: true };
  }),
  deleteMaterial: adminProcedure.input(z6.object({ id: z6.number() })).mutation(async ({ input }) => {
    await deleteMaterial(input.id);
    return { success: true };
  }),
  // ─── Prompt Templates ───────────────────────────────────────────────────────
  listPromptTemplates: orgProcedure.input(z6.object({ type: z6.string().optional() })).query(async ({ ctx, input }) => {
    return getAllPromptTemplates(input.type, ctx.orgId);
  }),
  createPromptTemplate: adminProcedure.input(z6.object({
    name: z6.string(),
    type: z6.enum(["mood", "material_board", "hero"]),
    templateText: z6.string(),
    variables: z6.array(z6.string())
  })).mutation(async ({ ctx, input }) => {
    return createPromptTemplate({ ...input, createdBy: ctx.user.id, orgId: ctx.user.orgId ?? void 0 });
  }),
  updatePromptTemplate: adminProcedure.input(z6.object({
    id: z6.number(),
    name: z6.string().optional(),
    templateText: z6.string().optional(),
    variables: z6.array(z6.string()).optional(),
    isActive: z6.boolean().optional()
  })).mutation(async ({ input }) => {
    const { id, ...updates } = input;
    await updatePromptTemplate(id, updates);
    return { success: true };
  }),
  // ─── Collaboration & Comments ───────────────────────────────────────────────
  addComment: protectedProcedure.input(z6.object({
    projectId: z6.number(),
    entityType: z6.enum(["design_brief", "material_board", "visual", "general"]),
    entityId: z6.number().optional(),
    content: z6.string().min(1)
  })).mutation(async ({ ctx, input }) => {
    return createComment({
      projectId: input.projectId,
      entityType: input.entityType,
      entityId: input.entityId,
      userId: ctx.user.id,
      content: input.content
    });
  }),
  listComments: protectedProcedure.input(z6.object({
    projectId: z6.number(),
    entityType: z6.string().optional(),
    entityId: z6.number().optional()
  })).query(async ({ input }) => {
    if (input.entityType) {
      return getCommentsByEntity(input.projectId, input.entityType, input.entityId);
    }
    return getCommentsByProject(input.projectId);
  }),
  // ─── Approval Gates ─────────────────────────────────────────────────────────
  updateApprovalState: protectedProcedure.input(z6.object({
    projectId: z6.number(),
    approvalState: z6.enum(["draft", "review", "approved_rfq", "approved_marketing"]),
    rationale: z6.string().optional()
  })).mutation(async ({ ctx, input }) => {
    await updateProjectApprovalState(input.projectId, input.approvalState);
    await createAuditLog({
      userId: ctx.user.id,
      action: "approval.update",
      entityType: "project",
      entityId: input.projectId,
      details: { approvalState: input.approvalState, rationale: input.rationale }
    });
    return { success: true };
  })
});

// server/routers/intelligence.ts
import { z as z7 } from "zod";

// server/engines/explainability.ts
var DIMENSION_LABELS2 = {
  sa: "Strategic Alignment",
  ff: "Financial Feasibility",
  mp: "Market Positioning",
  ds: "Design & Specification",
  er: "Execution Readiness"
};
var VARIABLE_LABELS = {
  // Context (6 variables)
  ctx01Typology: "Project Typology",
  ctx02Scale: "Project Scale",
  ctx03Gfa: "Gross Floor Area (sqm)",
  ctx04Location: "Location Category",
  ctx05Horizon: "Delivery Horizon",
  // Strategy (3 variables)
  str01BrandClarity: "Brand Clarity",
  str02Differentiation: "Differentiation Strategy",
  str03BuyerMaturity: "Buyer Maturity Understanding",
  // Financial (4 variables)
  fin01BudgetCap: "Budget Cap (AED/sqm)",
  fin02Flexibility: "Budget Flexibility",
  fin03ShockTolerance: "Shock Tolerance",
  fin04SalesPremium: "Sales Premium Potential",
  // Market (3 variables)
  mkt01Tier: "Market Tier",
  mkt02Competitor: "Competitive Awareness",
  mkt03Trend: "Trend Alignment",
  // Design (5 variables)
  des01Style: "Design Style",
  des02MaterialLevel: "Material Level",
  des03Complexity: "Design Complexity",
  des04Experience: "Experience Ambition",
  des05Sustainability: "Sustainability Commitment",
  // Execution (4 variables)
  exe01SupplyChain: "Supply Chain Readiness",
  exe02Contractor: "Contractor Capability",
  exe03Approvals: "Approval Complexity",
  exe04QaMaturity: "QA Maturity",
  // Add-ons (3 variables)
  add01SampleKit: "Sample Kit Requested",
  add02PortfolioMode: "Portfolio Mode",
  add03DashboardExport: "Dashboard Export"
};
var VARIABLE_TO_CONTRIBUTION_KEY = {
  sa: {
    str01BrandClarity: "str01_n",
    str02Differentiation: "compatVisionDesign",
    // str02 feeds into compatVisionDesign
    str03BuyerMaturity: "str03_n"
  },
  ff: {
    fin01BudgetCap: "budgetFit",
    // fin01 feeds into budgetFit composite
    fin02Flexibility: "fin02_n",
    fin03ShockTolerance: "costStability",
    // fin03 feeds into costStability = (1 - costVolatility)
    fin04SalesPremium: "executionResilience"
    // closest proxy in ff dimension
  },
  mp: {
    mkt01Tier: "marketFit",
    // mkt01 feeds into marketFit composite
    mkt02Competitor: "differentiationPressure",
    mkt03Trend: "trendFit"
  },
  ds: {
    des01Style: "str02_n",
    // style feeds through differentiation in ds
    des02MaterialLevel: "des02_n",
    des03Complexity: "des04_n",
    // complexity is in ds via des04 weight
    des04Experience: "des04_n",
    des05Sustainability: "competitorInverse"
    // closest proxy
  },
  er: {
    exe01SupplyChain: "supplyChainInverse",
    exe02Contractor: "executionResilience",
    exe03Approvals: "approvalsInverse",
    exe04QaMaturity: "executionResilience"
  }
};
var STRING_ENUM_VARS = /* @__PURE__ */ new Set(["mkt01Tier", "des01Style", "ctx01Typology", "ctx02Scale", "ctx04Location", "ctx05Horizon"]);
var BOOLEAN_VARS = /* @__PURE__ */ new Set(["add01SampleKit", "add02PortfolioMode", "add03DashboardExport"]);
var RAW_NUMERIC_VARS = /* @__PURE__ */ new Set(["fin01BudgetCap", "ctx03Gfa"]);
var ENUM_DISPLAY_LABELS = {
  mkt01Tier: {
    Mid: "Mid-Market",
    "Upper-mid": "Upper Mid-Market",
    Luxury: "Luxury",
    "Ultra-luxury": "Ultra-Luxury"
  },
  des01Style: {
    Modern: "Modern",
    Contemporary: "Contemporary",
    Minimal: "Minimal",
    Classic: "Classic",
    Fusion: "Fusion",
    Other: "Other"
  },
  ctx01Typology: {
    Residential: "Residential",
    "Mixed-use": "Mixed-Use",
    Hospitality: "Hospitality",
    Office: "Office"
  },
  ctx02Scale: {
    Small: "Small (<10,000 sqm)",
    Medium: "Medium (10,000\u201350,000 sqm)",
    Large: "Large (>50,000 sqm)"
  },
  ctx04Location: {
    Prime: "Prime Location",
    Secondary: "Secondary Location",
    Emerging: "Emerging Location"
  },
  ctx05Horizon: {
    "0-12m": "0\u201312 Months",
    "12-24m": "12\u201324 Months",
    "24-36m": "24\u201336 Months",
    "36m+": "36+ Months"
  }
};
var ENUM_QUALITY_MAP = {
  mkt01Tier: {
    "Ultra-luxury": "positive",
    Luxury: "positive",
    "Upper-mid": "neutral",
    Mid: "negative"
  },
  des01Style: {
    Modern: "neutral",
    Contemporary: "positive",
    Minimal: "neutral",
    Classic: "neutral",
    Fusion: "positive",
    Other: "negative"
  }
};
function generateExplainabilityReport(projectId, inputSnapshot, scoreData, benchmarkVersionTag, logicVersionName) {
  const dimScores = {
    sa: scoreData.saScore,
    ff: scoreData.ffScore,
    mp: scoreData.mpScore,
    ds: scoreData.dsScore,
    er: scoreData.erScore
  };
  const flatContributions = {};
  for (const [dim, val] of Object.entries(scoreData.variableContributions)) {
    if (typeof val === "object" && val !== null) {
      flatContributions[dim] = val;
    }
  }
  const dimensionVarMap = {
    sa: ["str01BrandClarity", "str02Differentiation", "str03BuyerMaturity", "ctx01Typology"],
    ff: ["fin01BudgetCap", "fin02Flexibility", "fin03ShockTolerance", "fin04SalesPremium", "ctx03Gfa"],
    mp: ["mkt01Tier", "mkt02Competitor", "mkt03Trend", "ctx04Location"],
    ds: ["des01Style", "des02MaterialLevel", "des03Complexity", "des04Experience", "des05Sustainability", "ctx02Scale"],
    er: ["exe01SupplyChain", "exe02Contractor", "exe03Approvals", "exe04QaMaturity", "ctx05Horizon", "add01SampleKit", "add02PortfolioMode", "add03DashboardExport"]
  };
  const allDrivers = [];
  const dimensions = Object.entries(dimScores).map(([dim, score]) => {
    const weight = scoreData.dimensionWeights[dim] ?? 0.2;
    const vars = dimensionVarMap[dim] ?? [];
    const dimContribs = flatContributions[dim] ?? {};
    const drivers = vars.map((v) => {
      const rawVal = inputSnapshot[v];
      const isStringEnum = STRING_ENUM_VARS.has(v);
      const isBooleanVar = BOOLEAN_VARS.has(v);
      const isRawNumeric = RAW_NUMERIC_VARS.has(v);
      let numVal = null;
      let normalizedValue = null;
      if (!isStringEnum && !isBooleanVar && !isRawNumeric && typeof rawVal === "number") {
        numVal = rawVal;
        normalizedValue = Math.max(0, Math.min(1, (rawVal - 1) / 4));
      } else if (!isStringEnum && !isBooleanVar && !isRawNumeric && typeof rawVal === "string") {
        const parsed = parseFloat(rawVal);
        if (!isNaN(parsed)) {
          numVal = parsed;
          normalizedValue = Math.max(0, Math.min(1, (parsed - 1) / 4));
        }
      } else if (isRawNumeric && typeof rawVal === "number") {
        numVal = rawVal;
        normalizedValue = null;
      }
      const contribKey = VARIABLE_TO_CONTRIBUTION_KEY[dim]?.[v];
      const contribution = contribKey ? dimContribs[contribKey] ?? 0 : 0;
      let direction;
      if (isStringEnum) {
        const enumMap = ENUM_QUALITY_MAP[v];
        direction = enumMap?.[String(rawVal)] ?? "neutral";
      } else if (isBooleanVar) {
        direction = rawVal === true ? "positive" : "neutral";
      } else if (isRawNumeric) {
        direction = "neutral";
      } else if (numVal !== null) {
        direction = numVal >= 4 ? "positive" : numVal <= 2 ? "negative" : "neutral";
      } else {
        direction = "neutral";
      }
      let displayValue;
      if (rawVal === void 0 || rawVal === null) {
        displayValue = "N/A";
      } else if (isBooleanVar) {
        displayValue = rawVal ? "Yes" : "No";
      } else if (isStringEnum) {
        const labelMap = ENUM_DISPLAY_LABELS[v];
        displayValue = labelMap?.[String(rawVal)] ?? String(rawVal);
      } else if (typeof rawVal === "number" || typeof rawVal === "string") {
        displayValue = rawVal;
      } else {
        displayValue = String(rawVal);
      }
      const explanation = buildVariableExplanation(v, displayValue, numVal, direction, isStringEnum || isBooleanVar);
      const driver = {
        variable: v,
        label: VARIABLE_LABELS[v] ?? v,
        rawValue: displayValue,
        normalizedValue,
        weight,
        contribution,
        direction,
        explanation
      };
      allDrivers.push(driver);
      return driver;
    });
    const positiveDrivers = drivers.filter((d) => d.direction === "positive");
    const negativeDrivers = drivers.filter((d) => d.direction === "negative");
    return {
      dimension: dim,
      label: DIMENSION_LABELS2[dim] ?? dim,
      score,
      weight,
      drivers,
      topPositive: positiveDrivers.length > 0 ? positiveDrivers[0].label : "None identified",
      topNegative: negativeDrivers.length > 0 ? negativeDrivers[0].label : "None identified",
      summary: buildDimensionSummary(dim, score, positiveDrivers, negativeDrivers)
    };
  });
  const sortedPositive = allDrivers.filter((d) => d.direction === "positive").sort((a, b) => b.contribution - a.contribution);
  const sortedNegative = allDrivers.filter((d) => d.direction === "negative").sort((a, b) => a.contribution - b.contribution);
  const decisionRationale = buildDecisionRationale(
    scoreData.compositeScore,
    scoreData.decisionStatus,
    scoreData.penalties,
    sortedPositive.slice(0, 3),
    sortedNegative.slice(0, 3)
  );
  const confidenceExplanation = buildConfidenceExplanation(
    scoreData.confidenceScore,
    inputSnapshot
  );
  return {
    projectId,
    compositeScore: scoreData.compositeScore,
    decisionStatus: scoreData.decisionStatus,
    dimensions,
    topDrivers: sortedPositive.slice(0, 5),
    topRisks: sortedNegative.slice(0, 5),
    materialExplanations: [],
    // populated externally if materials are selected
    decisionRationale,
    confidenceExplanation,
    benchmarkVersionUsed: benchmarkVersionTag,
    logicVersionUsed: logicVersionName,
    generatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
}
function buildVariableExplanation(variable, displayValue, numVal, direction, isStringEnum) {
  const label = VARIABLE_LABELS[variable] ?? variable;
  if (isStringEnum) {
    return `${label} is set to "${displayValue}". This ${direction === "positive" ? "strengthens" : direction === "negative" ? "weakens" : "has a neutral effect on"} the dimension evaluation.`;
  }
  if (numVal !== null) {
    if (direction === "positive") {
      return `${label} scored ${numVal}/5, indicating strong positioning in this area. This contributes positively to the overall evaluation.`;
    } else if (direction === "negative") {
      return `${label} scored ${numVal}/5, indicating a gap that may require attention. This creates downward pressure on the dimension score.`;
    }
    return `${label} scored ${numVal}/5, representing a neutral baseline position.`;
  }
  return `${label} is set to ${displayValue}.`;
}
function buildDimensionSummary(dim, score, positive, negative) {
  const label = DIMENSION_LABELS2[dim] ?? dim;
  const level = score >= 75 ? "strong" : score >= 55 ? "moderate" : "weak";
  let summary = `${label} shows ${level} performance at ${score.toFixed(1)}/100.`;
  if (positive.length > 0) {
    summary += ` Key strengths: ${positive.map((d) => d.label).join(", ")}.`;
  }
  if (negative.length > 0) {
    summary += ` Areas for improvement: ${negative.map((d) => d.label).join(", ")}.`;
  }
  return summary;
}
function buildDecisionRationale(composite, status, penalties, topPositive, topNegative) {
  let rationale = `The project achieved a composite score of ${composite.toFixed(1)}/100, resulting in a "${status}" decision. `;
  if (topPositive.length > 0) {
    rationale += `Primary strengths driving the score include ${topPositive.map((d) => d.label).join(", ")}. `;
  }
  if (topNegative.length > 0) {
    rationale += `Key areas requiring attention: ${topNegative.map((d) => d.label).join(", ")}. `;
  }
  if (penalties.length > 0) {
    const totalPenalty = penalties.reduce((sum, p) => sum + p.points, 0);
    rationale += `${penalties.length} penalty rule(s) applied, reducing the score by ${totalPenalty.toFixed(1)} points. `;
    rationale += `Penalty details: ${penalties.map((p) => `${p.reason} (-${p.points}pts)`).join("; ")}.`;
  }
  return rationale;
}
function buildConfidenceExplanation(confidenceScore, inputs) {
  const filledCount = Object.values(inputs).filter((v) => v !== null && v !== void 0 && v !== "").length;
  const totalVars = Object.keys(inputs).length;
  const completeness = totalVars > 0 ? filledCount / totalVars * 100 : 0;
  let explanation = `Confidence score: ${confidenceScore.toFixed(1)}/100. `;
  explanation += `Input completeness: ${completeness.toFixed(0)}% (${filledCount}/${totalVars} variables provided). `;
  if (confidenceScore >= 75) {
    explanation += "High confidence \u2014 sufficient data points and benchmark coverage for reliable evaluation.";
  } else if (confidenceScore >= 50) {
    explanation += "Moderate confidence \u2014 some data gaps or limited benchmark coverage may affect precision.";
  } else {
    explanation += "Low confidence \u2014 significant data gaps or missing benchmarks. Results should be treated as directional only.";
  }
  return explanation;
}
function buildAuditPack(explainability, inputSnapshot, benchmarkSnapshot, logicSnapshot, scenarioComparisons2, materialExplanations) {
  return {
    version: "2.12",
    generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    projectId: explainability.projectId,
    decision: {
      compositeScore: explainability.compositeScore,
      status: explainability.decisionStatus,
      rationale: explainability.decisionRationale,
      confidenceExplanation: explainability.confidenceExplanation
    },
    explainability: {
      dimensions: explainability.dimensions,
      topDrivers: explainability.topDrivers,
      topRisks: explainability.topRisks
    },
    inputs: inputSnapshot,
    benchmarkSnapshot,
    logicSnapshot,
    scenarioComparisons: scenarioComparisons2,
    materialExplanations,
    traceability: {
      benchmarkVersion: explainability.benchmarkVersionUsed,
      logicVersion: explainability.logicVersionUsed,
      engineVersion: "MIYAR v2.12"
    }
  };
}

// server/engines/outcome-learning.ts
function compareOutcomes(outcomes, predictions) {
  const comparisons = [];
  const predMap = new Map(predictions.map((p) => [p.projectId, p]));
  const costDeltas = [];
  const leadTimeDeltas = [];
  for (const outcome of outcomes) {
    const pred = predMap.get(outcome.projectId);
    if (!pred) continue;
    if (outcome.procurementActualCosts && pred.estimatedCost) {
      const totalActual = Object.values(outcome.procurementActualCosts).reduce((s, v) => s + v, 0);
      const delta = totalActual - pred.estimatedCost;
      const deltaPct = pred.estimatedCost > 0 ? delta / pred.estimatedCost * 100 : 0;
      costDeltas.push(deltaPct);
    }
    if (outcome.leadTimesActual && pred.estimatedLeadTime) {
      const maxActual = Math.max(...Object.values(outcome.leadTimesActual));
      const delta = maxActual - pred.estimatedLeadTime;
      const deltaPct = pred.estimatedLeadTime > 0 ? delta / pred.estimatedLeadTime * 100 : 0;
      leadTimeDeltas.push(deltaPct);
    }
  }
  if (costDeltas.length > 0) {
    const avgDelta = costDeltas.reduce((s, d) => s + d, 0) / costDeltas.length;
    comparisons.push({
      metric: "Procurement Cost",
      predicted: 100,
      // normalized
      actual: 100 + avgDelta,
      delta: avgDelta,
      deltaPct: avgDelta,
      direction: avgDelta > 5 ? "over" : avgDelta < -5 ? "under" : "aligned",
      significance: Math.abs(avgDelta) > 15 ? "high" : Math.abs(avgDelta) > 5 ? "medium" : "low"
    });
  }
  if (leadTimeDeltas.length > 0) {
    const avgDelta = leadTimeDeltas.reduce((s, d) => s + d, 0) / leadTimeDeltas.length;
    comparisons.push({
      metric: "Lead Time",
      predicted: 100,
      actual: 100 + avgDelta,
      delta: avgDelta,
      deltaPct: avgDelta,
      direction: avgDelta > 5 ? "over" : avgDelta < -5 ? "under" : "aligned",
      significance: Math.abs(avgDelta) > 20 ? "high" : Math.abs(avgDelta) > 10 ? "medium" : "low"
    });
  }
  return comparisons;
}
function suggestBenchmarkAdjustments(comparisons, projectCount) {
  const adjustments = [];
  for (const comp of comparisons) {
    if (comp.significance === "low") continue;
    const adjustmentPct = comp.deltaPct * 0.5;
    const confidence = Math.min(0.95, 0.3 + projectCount / 20 * 0.5);
    if (comp.metric === "Procurement Cost") {
      adjustments.push({
        field: "costPerSqftMid",
        currentValue: 100,
        suggestedValue: 100 + adjustmentPct,
        adjustmentPct,
        confidence,
        basedOnProjects: projectCount,
        rationale: `Actual procurement costs were ${Math.abs(comp.deltaPct).toFixed(1)}% ${comp.direction === "over" ? "higher" : "lower"} than benchmarks across ${projectCount} projects. Suggesting a ${Math.abs(adjustmentPct).toFixed(1)}% ${adjustmentPct > 0 ? "increase" : "decrease"} to cost benchmarks.`
      });
    }
    if (comp.metric === "Lead Time") {
      adjustments.push({
        field: "leadTimeDays",
        currentValue: 100,
        suggestedValue: 100 + adjustmentPct,
        adjustmentPct,
        confidence,
        basedOnProjects: projectCount,
        rationale: `Actual lead times were ${Math.abs(comp.deltaPct).toFixed(1)}% ${comp.direction === "over" ? "longer" : "shorter"} than benchmarks across ${projectCount} projects. Suggesting a ${Math.abs(adjustmentPct).toFixed(1)}% ${adjustmentPct > 0 ? "increase" : "decrease"} to lead time estimates.`
      });
    }
  }
  return adjustments;
}
function computeAccuracy(comparisons) {
  if (comparisons.length === 0) return 0;
  const accuracies = comparisons.map((c) => Math.max(0, 100 - Math.abs(c.deltaPct)));
  return accuracies.reduce((s, a) => s + a, 0) / accuracies.length;
}
function generateLearningReport(outcomes, predictions) {
  const comparisons = compareOutcomes(outcomes, predictions);
  const suggestedAdjustments = suggestBenchmarkAdjustments(comparisons, outcomes.length);
  const overallAccuracy = computeAccuracy(comparisons);
  return {
    totalOutcomes: outcomes.length,
    comparisons,
    suggestedAdjustments,
    overallAccuracy,
    generatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
}

// server/routers/intelligence.ts
import { nanoid as nanoid3 } from "nanoid";
var intelligenceRouter = router({
  // ─── V2.10: Logic Registry ──────────────────────────────────────────────────
  logicVersions: router({
    list: adminProcedure.query(async () => {
      return listLogicVersions();
    }),
    get: adminProcedure.input(z7.object({ id: z7.number() })).query(async ({ input }) => {
      const version = await getLogicVersionById(input.id);
      if (!version) return null;
      const weights = await getLogicWeights(input.id);
      const thresholds = await getLogicThresholds(input.id);
      const changeLog = await getLogicChangeLog(input.id);
      return { ...version, weights, thresholds, changeLog };
    }),
    getPublished: protectedProcedure.query(async () => {
      const version = await getPublishedLogicVersion();
      if (!version) return null;
      const weights = await getLogicWeights(version.id);
      const thresholds = await getLogicThresholds(version.id);
      return { ...version, weights, thresholds };
    }),
    create: adminProcedure.input(z7.object({ name: z7.string(), notes: z7.string().optional() })).mutation(async ({ input, ctx }) => {
      const id = await createLogicVersion({ ...input, createdBy: ctx.user.id });
      return { id };
    }),
    publish: adminProcedure.input(z7.object({ id: z7.number() })).mutation(async ({ input, ctx }) => {
      await publishLogicVersion(input.id);
      await addLogicChangeLogEntry({
        logicVersionId: input.id,
        actor: ctx.user.id,
        changeSummary: "Published logic version",
        rationale: "Set as active scoring logic"
      });
      return { success: true };
    }),
    archive: adminProcedure.input(z7.object({ id: z7.number() })).mutation(async ({ input, ctx }) => {
      await archiveLogicVersion(input.id);
      await addLogicChangeLogEntry({
        logicVersionId: input.id,
        actor: ctx.user.id,
        changeSummary: "Archived logic version",
        rationale: "Replaced by newer version"
      });
      return { success: true };
    }),
    setWeights: adminProcedure.input(
      z7.object({
        logicVersionId: z7.number(),
        weights: z7.array(z7.object({ dimension: z7.string(), weight: z7.string() })),
        rationale: z7.string()
      })
    ).mutation(async ({ input, ctx }) => {
      await setLogicWeights(input.logicVersionId, input.weights);
      await addLogicChangeLogEntry({
        logicVersionId: input.logicVersionId,
        actor: ctx.user.id,
        changeSummary: `Updated dimension weights: ${input.weights.map((w) => `${w.dimension}=${w.weight}`).join(", ")}`,
        rationale: input.rationale
      });
      return { success: true };
    }),
    setThresholds: adminProcedure.input(
      z7.object({
        logicVersionId: z7.number(),
        thresholds: z7.array(
          z7.object({
            ruleKey: z7.string(),
            thresholdValue: z7.string(),
            comparator: z7.enum(["gt", "gte", "lt", "lte", "eq", "neq"]),
            notes: z7.string().optional()
          })
        ),
        rationale: z7.string()
      })
    ).mutation(async ({ input, ctx }) => {
      await setLogicThresholds(input.logicVersionId, input.thresholds);
      await addLogicChangeLogEntry({
        logicVersionId: input.logicVersionId,
        actor: ctx.user.id,
        changeSummary: `Updated ${input.thresholds.length} threshold rules`,
        rationale: input.rationale
      });
      return { success: true };
    }),
    changeLog: adminProcedure.input(z7.object({ logicVersionId: z7.number() })).query(async ({ input }) => {
      return getLogicChangeLog(input.logicVersionId);
    })
  }),
  // ─── V2.10: Calibration ────────────────────────────────────────────────────
  calibrate: adminProcedure.input(z7.object({ projectId: z7.number() })).query(async ({ input }) => {
    const logicVersion = await getPublishedLogicVersion();
    if (!logicVersion) return { error: "No published logic version" };
    const weights = await getLogicWeights(logicVersion.id);
    const thresholds = await getLogicThresholds(logicVersion.id);
    const scores = await getScoreMatricesByProject(input.projectId);
    const latestScore = scores[0];
    if (!latestScore) return { error: "No evaluation found for project" };
    return {
      logicVersion: { id: logicVersion.id, name: logicVersion.name, status: logicVersion.status },
      weights: weights.map((w) => ({ dimension: w.dimension, weight: w.weight })),
      thresholds: thresholds.map((t2) => ({
        ruleKey: t2.ruleKey,
        thresholdValue: t2.thresholdValue,
        comparator: t2.comparator,
        notes: t2.notes
      })),
      currentScores: {
        sa: latestScore.saScore,
        ff: latestScore.ffScore,
        mp: latestScore.mpScore,
        ds: latestScore.dsScore,
        er: latestScore.erScore,
        composite: latestScore.compositeScore,
        risk: latestScore.rasScore
      }
    };
  }),
  // ─── V2.11: Scenario Simulation ────────────────────────────────────────────
  scenarios: router({
    saveInput: protectedProcedure.input(z7.object({ scenarioId: z7.number(), jsonInput: z7.unknown() })).mutation(async ({ input }) => {
      const id = await createScenarioInput({ scenarioId: input.scenarioId, jsonInput: input.jsonInput });
      return { id };
    }),
    getInput: protectedProcedure.input(z7.object({ scenarioId: z7.number() })).query(async ({ input }) => {
      return getScenarioInput(input.scenarioId);
    }),
    saveOutput: protectedProcedure.input(
      z7.object({
        scenarioId: z7.number(),
        scoreJson: z7.unknown(),
        roiJson: z7.unknown().optional(),
        riskJson: z7.unknown().optional(),
        boardCostJson: z7.unknown().optional(),
        benchmarkVersionId: z7.number().optional(),
        logicVersionId: z7.number().optional()
      })
    ).mutation(async ({ input }) => {
      const id = await createScenarioOutput(input);
      return { id };
    }),
    getOutput: protectedProcedure.input(z7.object({ scenarioId: z7.number() })).query(async ({ input }) => {
      return getScenarioOutput(input.scenarioId);
    }),
    listOutputs: protectedProcedure.input(z7.object({ scenarioIds: z7.array(z7.number()) })).query(async ({ input }) => {
      return listScenarioOutputs(input.scenarioIds);
    }),
    compare: protectedProcedure.input(
      z7.object({
        projectId: z7.number(),
        baselineScenarioId: z7.number(),
        comparedScenarioIds: z7.array(z7.number()),
        decisionNote: z7.string().optional()
      })
    ).mutation(async ({ input, ctx }) => {
      const allIds = [input.baselineScenarioId, ...input.comparedScenarioIds];
      const outputs = await listScenarioOutputs(allIds);
      const baselineOutput = outputs.find((o) => o.scenarioId === input.baselineScenarioId);
      const comparedOutputs = outputs.filter((o) => input.comparedScenarioIds.includes(o.scenarioId));
      const comparisonResult = {
        baseline: {
          scenarioId: input.baselineScenarioId,
          scores: baselineOutput?.scoreJson ?? null,
          roi: baselineOutput?.roiJson ?? null
        },
        compared: comparedOutputs.map((o) => ({
          scenarioId: o.scenarioId,
          scores: o.scoreJson,
          roi: o.roiJson,
          deltas: computeDeltas(baselineOutput?.scoreJson, o.scoreJson)
        })),
        generatedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      const id = await createScenarioComparison({
        ...input,
        comparisonResult,
        createdBy: ctx.user.id
      });
      return { id, comparisonResult };
    }),
    listComparisons: protectedProcedure.input(z7.object({ projectId: z7.number() })).query(async ({ input }) => {
      return listScenarioComparisons(input.projectId);
    }),
    getComparison: protectedProcedure.input(z7.object({ id: z7.number() })).query(async ({ input }) => {
      return getScenarioComparisonById(input.id);
    }),
    exportComparisonPDF: protectedProcedure.input(z7.object({ comparisonId: z7.number() })).mutation(async ({ input }) => {
      const comparison = await getScenarioComparisonById(input.comparisonId);
      if (!comparison) throw new Error("Comparison not found");
      const project = await getProjectById(comparison.projectId);
      if (!project) throw new Error("Project not found");
      const allScenarios = await getScenariosByProject(comparison.projectId);
      const scenarioMap = new Map(allScenarios.map((s) => [s.id, s.name]));
      const compResult = comparison.comparisonResult ?? {};
      const baseline = compResult.baseline ?? {};
      const compared = compResult.compared ?? [];
      const benchmarkVersion = await getActiveBenchmarkVersion();
      const logicVersion = await getPublishedLogicVersion();
      const pdfInput = {
        projectName: project.name,
        projectId: comparison.projectId,
        baselineScenario: {
          id: comparison.baselineScenarioId,
          name: scenarioMap.get(comparison.baselineScenarioId) ?? `Scenario #${comparison.baselineScenarioId}`,
          scores: baseline.scores ?? null,
          roi: baseline.roi ?? null
        },
        comparedScenarios: compared.map((c) => {
          const sid = c.scenarioId;
          return {
            id: sid,
            name: scenarioMap.get(sid) ?? `Scenario #${sid}`,
            scores: c.scores ?? null,
            roi: c.roi ?? null,
            deltas: c.deltas ?? null
          };
        }),
        decisionNote: comparison.decisionNote ?? void 0,
        benchmarkVersion: benchmarkVersion?.versionTag ?? "v1.0-baseline",
        logicVersion: logicVersion?.name ?? "Default"
      };
      const html = generateScenarioComparisonHTML(pdfInput);
      const fileKey = `reports/${comparison.projectId}/scenario-comparison-${nanoid3(8)}.html`;
      const { url } = await storagePut(fileKey, html, "text/html");
      return { url, html };
    })
  }),
  // ─── V2.12: Explainability ─────────────────────────────────────────────────
  explainability: router({
    generate: protectedProcedure.input(z7.object({ projectId: z7.number() })).query(async ({ input }) => {
      const project = await getProjectById(input.projectId);
      if (!project) return null;
      const scores = await getScoreMatricesByProject(input.projectId);
      const latestScore = scores[0];
      if (!latestScore) return null;
      const logicVersion = await getPublishedLogicVersion();
      const weights = logicVersion ? await getLogicWeights(logicVersion.id) : [];
      const benchmarkVersion = await getActiveBenchmarkVersion();
      const dimensionWeights = {};
      for (const w of weights) {
        dimensionWeights[w.dimension] = parseFloat(w.weight);
      }
      if (Object.keys(dimensionWeights).length === 0) {
        dimensionWeights.sa = 0.2;
        dimensionWeights.ff = 0.2;
        dimensionWeights.mp = 0.2;
        dimensionWeights.ds = 0.2;
        dimensionWeights.er = 0.2;
      }
      const inputSnapshot = latestScore.inputSnapshot ?? project.inputSnapshot ?? {};
      const variableContributions = latestScore.variableContributions ?? {};
      const penalties = latestScore.penalties ?? [];
      const riskFlags = latestScore.riskFlags ?? [];
      return generateExplainabilityReport(
        input.projectId,
        inputSnapshot,
        {
          saScore: Number(latestScore.saScore),
          ffScore: Number(latestScore.ffScore),
          mpScore: Number(latestScore.mpScore),
          dsScore: Number(latestScore.dsScore),
          erScore: Number(latestScore.erScore),
          compositeScore: Number(latestScore.compositeScore),
          riskScore: Number(latestScore.rasScore),
          confidenceScore: Number(latestScore.confidenceScore),
          decisionStatus: latestScore.decisionStatus ?? "pending",
          dimensionWeights,
          variableContributions,
          penalties,
          riskFlags
        },
        benchmarkVersion?.versionTag ?? "v1.0",
        logicVersion?.name ?? "Default"
      );
    }),
    auditPack: protectedProcedure.input(z7.object({ projectId: z7.number() })).mutation(async ({ input }) => {
      const project = await getProjectById(input.projectId);
      if (!project) return { error: "Project not found" };
      const scores = await getScoreMatricesByProject(input.projectId);
      const latestScore = scores[0];
      if (!latestScore) return { error: "No evaluation found" };
      const logicVersion = await getPublishedLogicVersion();
      const weights = logicVersion ? await getLogicWeights(logicVersion.id) : [];
      const thresholds = logicVersion ? await getLogicThresholds(logicVersion.id) : [];
      const benchmarkVersion = await getActiveBenchmarkVersion();
      const inputSnapshot = latestScore.inputSnapshot ?? project.inputSnapshot ?? {};
      const dimensionWeights = {};
      for (const w of weights) {
        dimensionWeights[w.dimension] = parseFloat(w.weight);
      }
      const variableContributions = latestScore.variableContributions ?? {};
      const penalties = latestScore.penalties ?? [];
      const riskFlags = latestScore.riskFlags ?? [];
      const explainability = generateExplainabilityReport(
        input.projectId,
        inputSnapshot,
        {
          saScore: Number(latestScore.saScore),
          ffScore: Number(latestScore.ffScore),
          mpScore: Number(latestScore.mpScore),
          dsScore: Number(latestScore.dsScore),
          erScore: Number(latestScore.erScore),
          compositeScore: Number(latestScore.compositeScore),
          riskScore: Number(latestScore.rasScore),
          confidenceScore: Number(latestScore.confidenceScore),
          decisionStatus: latestScore.decisionStatus ?? "pending",
          dimensionWeights,
          variableContributions,
          penalties,
          riskFlags
        },
        benchmarkVersion?.versionTag ?? "v1.0",
        logicVersion?.name ?? "Default"
      );
      const comparisons = await listScenarioComparisons(input.projectId);
      const auditPack = buildAuditPack(
        explainability,
        inputSnapshot,
        benchmarkVersion ?? {},
        {
          weights: weights.map((w) => ({ dimension: w.dimension, weight: w.weight })),
          thresholds: thresholds.map((t2) => ({
            ruleKey: t2.ruleKey,
            thresholdValue: t2.thresholdValue,
            comparator: t2.comparator ?? "gte"
          }))
        },
        comparisons,
        []
      );
      const jsonStr = JSON.stringify(auditPack, null, 2);
      const fileName = `audit-packs/${input.projectId}-${Date.now()}.json`;
      const { url } = await storagePut(fileName, Buffer.from(jsonStr), "application/json");
      return { url, auditPack };
    })
  }),
  // ─── V2.13: Outcomes ───────────────────────────────────────────────────────
  outcomes: router({
    capture: protectedProcedure.input(
      z7.object({
        projectId: z7.number(),
        procurementActualCosts: z7.record(z7.string(), z7.number()).optional(),
        leadTimesActual: z7.record(z7.string(), z7.number()).optional(),
        rfqResults: z7.record(z7.string(), z7.number()).optional(),
        adoptionMetrics: z7.record(z7.string(), z7.unknown()).optional(),
        // V5 Fields
        actualFitoutCostPerSqm: z7.number().optional(),
        reworkOccurred: z7.boolean().optional(),
        clientSatisfactionScore: z7.number().min(1).max(5).optional(),
        projectDeliveredOnTime: z7.boolean().optional()
      })
    ).mutation(async ({ input, ctx }) => {
      const id = await createProjectOutcome({
        ...input,
        capturedBy: ctx.user.id
      });
      return { id };
    }),
    list: protectedProcedure.input(z7.object({ projectId: z7.number() })).query(async ({ input }) => {
      return getProjectOutcomes(input.projectId);
    }),
    listAll: adminProcedure.query(async () => {
      return listAllOutcomes();
    })
  }),
  // ─── V2.13: Benchmark Learning ─────────────────────────────────────────────
  benchmarkLearning: router({
    generateSuggestions: adminProcedure.mutation(async ({ ctx }) => {
      const outcomes = await listAllOutcomes();
      if (outcomes.length === 0) {
        return { message: "No outcomes captured yet. Capture project outcomes first." };
      }
      const predictions = [];
      for (const outcome of outcomes) {
        const scores = await getScoreMatricesByProject(outcome.projectId);
        const latest = scores[0];
        if (latest) {
          predictions.push({
            projectId: outcome.projectId,
            estimatedCost: Number(latest.compositeScore) * 100,
            // simplified proxy
            estimatedLeadTime: 90,
            // default estimate
            estimatedRfqRounds: 3
          });
        }
      }
      const outcomesForLearning = outcomes.map((o) => ({
        projectId: o.projectId,
        procurementActualCosts: o.procurementActualCosts ?? void 0,
        leadTimesActual: o.leadTimesActual ?? void 0,
        rfqResults: o.rfqResults ?? void 0
      }));
      const report = generateLearningReport(outcomesForLearning, predictions);
      if (report.suggestedAdjustments.length > 0) {
        await createBenchmarkSuggestion({
          basedOnOutcomesQuery: `${outcomes.length} outcomes analyzed`,
          suggestedChanges: report.suggestedAdjustments,
          confidence: report.overallAccuracy > 70 ? "high" : report.overallAccuracy > 40 ? "medium" : "low"
        });
      }
      return report;
    }),
    listSuggestions: adminProcedure.query(async () => {
      return listBenchmarkSuggestions();
    }),
    reviewSuggestion: adminProcedure.input(
      z7.object({
        id: z7.number(),
        status: z7.enum(["accepted", "rejected"]),
        reviewerNotes: z7.string().optional()
      })
    ).mutation(async ({ input, ctx }) => {
      await reviewBenchmarkSuggestion(input.id, {
        status: input.status,
        reviewerNotes: input.reviewerNotes,
        reviewedBy: ctx.user.id
      });
      return { success: true };
    })
  })
});
function computeDeltas(baseline, compared) {
  const deltas = {};
  if (!baseline || !compared) return deltas;
  const b = baseline;
  const c = compared;
  const fields = ["saScore", "ffScore", "mpScore", "dsScore", "erScore", "compositeScore"];
  for (const f of fields) {
    if (typeof b[f] === "number" && typeof c[f] === "number") {
      deltas[f] = c[f] - b[f];
    }
  }
  return deltas;
}

// server/routers/market-intelligence.ts
import { z as z9 } from "zod";
import { nanoid as nanoid4 } from "nanoid";

// server/engines/ingestion/connector.ts
import { z as z8 } from "zod";
import robotsParser from "robots-parser";
var USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15"
];
var CAPTCHA_INDICATORS = ["cf-browser-verification", "g-recaptcha", "px-captcha", "Please verify you are a human"];
var PAYWALL_INDICATORS = ["subscribe to read", "premium content", "paywall"];
function getRandomUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}
var robotsCache = /* @__PURE__ */ new Map();
async function checkRobotsTxt(targetUrl, userAgent) {
  try {
    const urlObj = new URL(targetUrl);
    const origin = urlObj.origin;
    let robots = robotsCache.get(origin);
    if (!robots) {
      const robotsUrl = `${origin}/robots.txt`;
      const res = await globalThis.fetch(robotsUrl, { headers: { "User-Agent": userAgent } });
      if (res.ok) {
        const text2 = await res.text();
        robots = robotsParser(robotsUrl, text2);
      } else {
        robots = robotsParser(robotsUrl, "");
      }
      robotsCache.set(origin, robots);
    }
    return robots.isAllowed(targetUrl, userAgent) !== false;
  } catch (err) {
    return true;
  }
}
var rawSourcePayloadSchema = z8.object({
  url: z8.string().url(),
  fetchedAt: z8.date(),
  rawHtml: z8.string().optional(),
  rawJson: z8.record(z8.string(), z8.unknown()).optional(),
  statusCode: z8.number().int(),
  error: z8.string().optional()
});
var extractedEvidenceSchema = z8.object({
  title: z8.string().min(1),
  rawText: z8.string().min(1),
  publishedDate: z8.date().optional(),
  category: z8.enum(["material_cost", "fitout_rate", "market_trend", "competitor_project"]),
  geography: z8.string().min(1),
  sourceUrl: z8.string().url()
});
var normalizedEvidenceInputSchema = z8.object({
  metric: z8.string().min(1),
  value: z8.number().nullable(),
  unit: z8.string().nullable(),
  confidence: z8.number().min(0).max(1),
  grade: z8.enum(["A", "B", "C"]),
  summary: z8.string().min(1),
  tags: z8.array(z8.string())
});
var GRADE_A_SOURCE_IDS = /* @__PURE__ */ new Set([
  "emaar-properties",
  "damac-properties",
  "nakheel-properties",
  "rics-market-reports",
  "jll-mena-research",
  "dubai-statistics-center"
]);
var GRADE_B_SOURCE_IDS = /* @__PURE__ */ new Set([
  "rak-ceramics-uae",
  "porcelanosa-uae",
  "hafele-uae",
  "gems-building-materials",
  "dragon-mart-dubai"
]);
var GRADE_C_SOURCE_IDS = /* @__PURE__ */ new Set([
  "dera-interiors"
]);
function assignGrade(sourceId) {
  if (GRADE_A_SOURCE_IDS.has(sourceId)) return "A";
  if (GRADE_B_SOURCE_IDS.has(sourceId)) return "B";
  if (GRADE_C_SOURCE_IDS.has(sourceId)) return "C";
  return "C";
}
var BASE_CONFIDENCE = { A: 0.85, B: 0.7, C: 0.55 };
var RECENCY_BONUS = 0.1;
var STALENESS_PENALTY = -0.15;
var CONFIDENCE_CAP = 1;
var CONFIDENCE_FLOOR = 0.2;
function computeConfidence2(grade2, publishedDate, fetchedAt) {
  let confidence = BASE_CONFIDENCE[grade2];
  if (!publishedDate) {
    confidence += STALENESS_PENALTY;
  } else {
    const daysSincePublished = Math.floor(
      (fetchedAt.getTime() - publishedDate.getTime()) / (1e3 * 60 * 60 * 24)
    );
    if (daysSincePublished <= 90) {
      confidence += RECENCY_BONUS;
    } else if (daysSincePublished > 365) {
      confidence += STALENESS_PENALTY;
    }
  }
  return Math.min(CONFIDENCE_CAP, Math.max(CONFIDENCE_FLOOR, confidence));
}
var FETCH_TIMEOUT_MS = 15e3;
var MAX_RETRIES = 3;
var BASE_BACKOFF_MS = 1e3;
var BaseSourceConnector = class {
  /** Set by orchestrator before fetch to enable incremental ingestion */
  lastSuccessfulFetch;
  requestDelayMs;
  /**
   * Shared fetch with timeout (15s) and exponential backoff retry (max 3 attempts).
   * Returns RawSourcePayload with error field populated on failure.
   */
  async fetch() {
    let lastError;
    const userAgent = getRandomUserAgent();
    const isAllowed = await checkRobotsTxt(this.sourceUrl, userAgent);
    if (!isAllowed) {
      return {
        url: this.sourceUrl,
        fetchedAt: /* @__PURE__ */ new Date(),
        statusCode: 403,
        error: "Blocked by origin robots.txt"
      };
    }
    if (this.requestDelayMs && this.requestDelayMs > 0) {
      await new Promise((r) => setTimeout(r, this.requestDelayMs));
    }
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
        const response = await globalThis.fetch(this.sourceUrl, {
          signal: controller.signal,
          headers: {
            "User-Agent": userAgent,
            "Accept": "text/html,application/json,application/xml;q=0.9,*/*;q=0.8"
          }
        });
        clearTimeout(timeout);
        const contentType = response.headers.get("content-type") || "";
        let rawHtml;
        let rawJson;
        if (contentType.includes("application/json")) {
          rawJson = await response.json();
        } else {
          rawHtml = await response.text();
          if (CAPTCHA_INDICATORS.some((ind) => rawHtml.includes(ind))) {
            throw new Error("CAPTCHA challenge detected on page");
          }
          if (PAYWALL_INDICATORS.some((ind) => rawHtml.toLowerCase().includes(ind))) {
            throw new Error("Paywall detected on page content");
          }
          if (rawHtml.trim().startsWith("{") || rawHtml.trim().startsWith("[")) {
            try {
              rawJson = JSON.parse(rawHtml);
            } catch {
            }
          }
        }
        return {
          url: this.sourceUrl,
          fetchedAt: /* @__PURE__ */ new Date(),
          rawHtml,
          rawJson,
          statusCode: response.status,
          error: response.ok ? void 0 : `HTTP ${response.status} ${response.statusText}`
        };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        lastError = errorMsg;
        if (attempt < MAX_RETRIES) {
          const backoffMs = BASE_BACKOFF_MS * Math.pow(2, attempt - 1);
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
        }
      }
    }
    return {
      url: this.sourceUrl,
      fetchedAt: /* @__PURE__ */ new Date(),
      statusCode: 0,
      error: `Failed after ${MAX_RETRIES} attempts: ${lastError}`
    };
  }
};

// server/engines/ingestion/connectors/dynamic.ts
init_llm();
var LLM_EXTRACTION_SYSTEM_PROMPT = `You are a data extraction engine for the MIYAR real estate intelligence platform.
You extract structured evidence from raw HTML or JSON content of UAE construction/real estate websites.
Return ONLY valid JSON. Do not include markdown code fences or any other text.`;
function buildDynamicPrompt(sourceName, category, geography, contentSnippet, hints, lastFetch) {
  const dateFilter = lastFetch ? `
Focus on content published or updated after ${lastFetch.toISOString().split("T")[0]}.` : "";
  const hintsFilter = hints ? `
EXTRACTION HINTS: ${hints}` : "";
  return `Extract evidence items from this ${sourceName} source content.
Category: ${category}
Geography: ${geography}${dateFilter}${hintsFilter}

Return a JSON array of objects with these exact fields:
- title: string (item/product/project name)
- rawText: string (relevant text snippet, max 500 chars)
- publishedDate: string|null (ISO date if found, null otherwise)
- metric: string (what is being measured, e.g. "Marble Tile 60x60 price")
- value: number|null (numeric value in AED if found, null otherwise)
- unit: string|null (e.g. "sqm", "sqft", "piece", "unit", null if not applicable)

Rules:
- Extract up to 15 items maximum
- Only extract items with real data (titles, prices, descriptions)
- Do NOT invent data \u2014 if no items found, return empty array []
- Do NOT output confidence, grade, or scoring fields

Content (truncated to 8000 chars):
${contentSnippet.substring(0, 8e3)}`;
}
var DynamicConnector = class extends BaseSourceConnector {
  sourceId;
  sourceName;
  sourceUrl;
  category;
  geography;
  scrapeMethod;
  extractionHints;
  defaultUnit = "unit";
  defaultTags = [];
  constructor(config) {
    super();
    this.sourceId = String(config.id);
    this.sourceName = config.name;
    this.sourceUrl = config.url;
    const typeCategoryMap = {
      supplier_catalog: "material_cost",
      manufacturer_catalog: "material_cost",
      retailer_listing: "material_cost",
      developer_brochure: "competitor_project",
      industry_report: "market_trend",
      government_tender: "project_award",
      trade_publication: "market_trend",
      other: "other"
    };
    this.category = typeCategoryMap[config.sourceType || "other"] || "other";
    this.geography = config.region || "UAE";
    this.scrapeMethod = config.scrapeMethod || "html_llm";
    this.extractionHints = config.extractionHints || "";
    if (config.lastSuccessfulFetch) {
      this.lastSuccessfulFetch = new Date(config.lastSuccessfulFetch);
    }
  }
  async extract(raw) {
    const isHtml = !!raw.rawHtml;
    const content = isHtml ? raw.rawHtml : JSON.stringify(raw.rawJson || {});
    if (!content || content.length < 50) return [];
    if (this.scrapeMethod === "html_llm" || this.scrapeMethod === "json_api") {
      try {
        const textContent = isHtml ? content.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "").replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : content;
        const response = await invokeLLM({
          messages: [
            { role: "system", content: LLM_EXTRACTION_SYSTEM_PROMPT },
            {
              role: "user",
              content: buildDynamicPrompt(
                this.sourceName,
                this.category,
                this.geography,
                textContent,
                this.extractionHints,
                this.lastSuccessfulFetch
              )
            }
          ],
          response_format: { type: "json_object" }
        });
        const resText = typeof response.choices[0]?.message?.content === "string" ? response.choices[0].message.content : "";
        if (!resText) return [];
        const parsed = JSON.parse(resText);
        const items = Array.isArray(parsed) ? parsed : parsed.items || parsed.data || [];
        if (!Array.isArray(items)) return [];
        return items.filter((item) => item && typeof item.title === "string" && item.title.length > 0).slice(0, 15).map((item) => ({
          title: `${this.sourceName} - ${String(item.title).substring(0, 255)}`,
          rawText: String(item.rawText || item.description || item.title || "").substring(0, 500),
          publishedDate: item.publishedDate ? new Date(item.publishedDate) : void 0,
          category: this.category,
          geography: this.geography,
          sourceUrl: raw.url,
          _llmMetric: String(item.metric || item.title || "").substring(0, 255),
          _llmValue: typeof item.value === "number" && isFinite(item.value) ? item.value : null,
          _llmUnit: typeof item.unit === "string" ? item.unit : null
        }));
      } catch (err) {
        console.error(`[DynamicConnector] Extraction failed for ${this.sourceName}: `, err);
        return [];
      }
    }
    return [];
  }
  async normalize(evidence) {
    const grade2 = assignGrade(this.sourceId);
    const confidence = computeConfidence2(grade2, evidence.publishedDate, /* @__PURE__ */ new Date());
    const llmEvidence = evidence;
    return {
      metric: llmEvidence._llmMetric || evidence.title,
      value: llmEvidence._llmValue ?? null,
      unit: llmEvidence._llmUnit ?? this.defaultUnit,
      confidence,
      grade: grade2,
      summary: (evidence.rawText || "").replace(/\s+/g, " ").trim().substring(0, 500),
      tags: this.defaultTags
    };
  }
};

// server/engines/ingestion/orchestrator.ts
import { randomUUID as randomUUID2 } from "crypto";

// server/engines/ingestion/proposal-generator.ts
import { randomUUID } from "crypto";

// server/engines/ingestion/freshness.ts
var FRESHNESS_FRESH_DAYS = 90;
var FRESHNESS_AGING_DAYS = 365;
var FRESHNESS_WEIGHT_FRESH = 1;
var FRESHNESS_WEIGHT_AGING = 0.75;
var FRESHNESS_WEIGHT_STALE = 0.5;
function computeFreshness(captureDate, referenceDate) {
  const capture = captureDate instanceof Date ? captureDate : new Date(captureDate);
  const ref = referenceDate ?? /* @__PURE__ */ new Date();
  const ageDays = Math.max(0, Math.floor((ref.getTime() - capture.getTime()) / (24 * 60 * 60 * 1e3)));
  if (ageDays <= FRESHNESS_FRESH_DAYS) {
    return {
      status: "fresh",
      weight: FRESHNESS_WEIGHT_FRESH,
      ageDays,
      badgeColor: "green"
    };
  }
  if (ageDays <= FRESHNESS_AGING_DAYS) {
    return {
      status: "aging",
      weight: FRESHNESS_WEIGHT_AGING,
      ageDays,
      badgeColor: "amber"
    };
  }
  return {
    status: "stale",
    weight: FRESHNESS_WEIGHT_STALE,
    ageDays,
    badgeColor: "red"
  };
}
function getFreshnessWeight(captureDate, referenceDate) {
  return computeFreshness(captureDate, referenceDate).weight;
}

// server/engines/ingestion/proposal-generator.ts
async function generateBenchmarkProposals(options = {}) {
  const { category, minEvidenceCount = 3, actorId, ingestionRunId } = options;
  const runId = `PROP-${randomUUID().substring(0, 8)}`;
  const startedAt = /* @__PURE__ */ new Date();
  const evidence = await listEvidenceRecords({
    category,
    limit: 1e4
  });
  if (evidence.length === 0) {
    return { proposalsCreated: 0, groupsAnalyzed: 0, totalEvidence: 0, proposals: [] };
  }
  const groups = /* @__PURE__ */ new Map();
  for (const rec of evidence) {
    const key = `${rec.category}:${rec.unit}`;
    const existing = groups.get(key) ?? [];
    existing.push(rec);
    groups.set(key, existing);
  }
  const proposals = [];
  let proposalsCreated = 0;
  for (const [benchmarkKey, records] of Array.from(groups.entries())) {
    if (records.length < minEvidenceCount) continue;
    const prices = records.map((r) => Number(r.priceTypical ?? r.currencyAed ?? 0)).filter((p) => p > 0).sort((a, b) => a - b);
    if (prices.length === 0) continue;
    const p25 = prices[Math.floor(prices.length * 0.25)] ?? prices[0];
    const p50 = prices[Math.floor(prices.length * 0.5)] ?? prices[0];
    const p75 = prices[Math.floor(prices.length * 0.75)] ?? prices[prices.length - 1];
    const weightMap = { A: 3, B: 2, C: 1 };
    let weightedSum = 0;
    let totalWeight = 0;
    for (const rec of records) {
      const price = Number(rec.priceTypical ?? rec.currencyAed ?? 0);
      if (price <= 0) continue;
      const gradeWeight2 = weightMap[rec.reliabilityGrade] ?? 1;
      const freshnessWeight = getFreshnessWeight(rec.captureDate);
      const combinedWeight = gradeWeight2 * freshnessWeight;
      weightedSum += price * combinedWeight;
      totalWeight += combinedWeight;
    }
    const weightedMean = totalWeight > 0 ? weightedSum / totalWeight : p50;
    const reliabilityDist = { A: 0, B: 0, C: 0 };
    for (const rec of records) {
      reliabilityDist[rec.reliabilityGrade]++;
    }
    const now = Date.now();
    const recencyDist = { recent: 0, mid: 0, old: 0 };
    for (const rec of records) {
      const age = now - new Date(rec.captureDate).getTime();
      const months = age / (30 * 24 * 60 * 60 * 1e3);
      if (months <= 3) recencyDist.recent++;
      else if (months <= 12) recencyDist.mid++;
      else recencyDist.old++;
    }
    const uniqueSources = new Set(records.map((r) => r.sourceRegistryId ?? r.sourceUrl));
    const sourceDiversity = uniqueSources.size;
    let confidence = 50;
    if (records.length >= 10) confidence += 15;
    else if (records.length >= 5) confidence += 10;
    if (sourceDiversity >= 3) confidence += 15;
    else if (sourceDiversity >= 2) confidence += 10;
    if (reliabilityDist.A >= records.length * 0.5) confidence += 10;
    if (recencyDist.recent >= records.length * 0.5) confidence += 10;
    confidence = Math.min(100, confidence);
    let recommendation = "publish";
    let rejectionReason;
    if (records.length < 5) {
      recommendation = "reject";
      rejectionReason = `Insufficient sample size: ${records.length} < 5`;
    } else if (sourceDiversity < 2) {
      recommendation = "reject";
      rejectionReason = `Insufficient source diversity: ${sourceDiversity} < 2`;
    } else if (confidence < 40) {
      recommendation = "reject";
      rejectionReason = `Low confidence score: ${confidence}`;
    }
    try {
      const result = await createBenchmarkProposal({
        benchmarkKey,
        proposedP25: String(p25.toFixed(2)),
        proposedP50: String(p50.toFixed(2)),
        proposedP75: String(p75.toFixed(2)),
        weightedMean: String(weightedMean.toFixed(2)),
        evidenceCount: records.length,
        sourceDiversity,
        reliabilityDist,
        recencyDist,
        confidenceScore: confidence,
        recommendation,
        rejectionReason,
        runId
      });
      proposals.push({ id: result.id, benchmarkKey, recommendation });
      proposalsCreated++;
    } catch (err) {
      console.error(`[ProposalGenerator] Failed to create proposal for ${benchmarkKey}:`, err);
    }
  }
  try {
    await createIntelligenceAuditEntry({
      runType: "benchmark_proposal",
      runId,
      actor: actorId ?? null,
      inputSummary: {
        category,
        minEvidenceCount,
        totalEvidence: evidence.length,
        triggeredByIngestion: ingestionRunId ?? null
      },
      outputSummary: { proposalsCreated, groups: groups.size },
      sourcesProcessed: evidence.length,
      recordsExtracted: proposalsCreated,
      errors: 0,
      startedAt,
      completedAt: /* @__PURE__ */ new Date()
    });
  } catch (err) {
    console.error("[ProposalGenerator] Failed to log audit entry:", err);
  }
  return {
    proposalsCreated,
    groupsAnalyzed: groups.size,
    totalEvidence: evidence.length,
    proposals
  };
}

// server/engines/ingestion/change-detector.ts
async function detectPriceChange(currentRecord) {
  if (!currentRecord.priceTypical || !currentRecord.sourceRegistryId) return null;
  const currentPrice = parseFloat(currentRecord.priceTypical);
  if (isNaN(currentPrice)) return null;
  const previousRecord = await getPreviousEvidenceRecord(
    currentRecord.itemName,
    currentRecord.sourceRegistryId,
    currentRecord.captureDate
  );
  if (!previousRecord || !previousRecord.priceTypical) return null;
  const previousPrice = parseFloat(previousRecord.priceTypical);
  if (isNaN(previousPrice)) return null;
  if (currentPrice === previousPrice) return null;
  const changePct = (currentPrice - previousPrice) / Math.abs(previousPrice) * 100;
  const changeDirection = currentPrice > previousPrice ? "increased" : "decreased";
  let severity = "none";
  const absChange = Math.abs(changePct);
  if (absChange >= 10) severity = "significant";
  else if (absChange >= 5) severity = "notable";
  else if (absChange > 0) severity = "minor";
  if (severity === "none") return null;
  const result = await createPriceChangeEvent({
    itemName: currentRecord.itemName.substring(0, 255),
    category: currentRecord.category.substring(0, 255),
    sourceId: currentRecord.sourceRegistryId,
    previousPrice: previousPrice.toString(),
    newPrice: currentPrice.toString(),
    changePct: changePct.toString(),
    changeDirection,
    severity,
    detectedAt: currentRecord.captureDate
  });
  if (severity === "significant" || severity === "notable") {
    const insightType = changeDirection === "increased" ? "cost_pressure" : "market_opportunity";
    await insertProjectInsight({
      insightType,
      severity: severity === "significant" ? "critical" : "warning",
      title: `${changeDirection === "increased" ? "Price Spike" : "Price Drop"} Detected: ${currentRecord.itemName}`.substring(0, 512),
      body: `A ${severity} price ${changeDirection} of ${Math.abs(changePct).toFixed(1)}% was detected for ${currentRecord.itemName} supplied via ${currentRecord.publisher}. Previous: ${previousPrice} AED, New: ${currentPrice} AED.`,
      actionableRecommendation: `Review associated material benchmarks to adjust expected forecasting costs accordingly.`,
      confidenceScore: "0.85",
      dataPoints: [
        { label: "Previous Price", value: previousPrice.toString() },
        { label: "New Price", value: currentPrice.toString() },
        { label: "Deviation %", value: `${changePct.toFixed(1)}%` }
      ],
      triggerCondition: `Change detector alert: abs(change) >= ${severity === "significant" ? 10 : 5}%`
    });
  }
  return {
    id: result.id,
    itemName: currentRecord.itemName,
    previousPrice,
    newPrice: currentPrice,
    changePct,
    changeDirection,
    severity
  };
}

// server/engines/analytics/trend-detection.ts
init_llm();
var DEFAULT_MA_WINDOW_DAYS = 30;
var DIRECTION_CHANGE_THRESHOLD = 0.05;
var ANOMALY_STD_DEV_THRESHOLD = 2;
var CONFIDENCE_HIGH_MIN_POINTS = 15;
var CONFIDENCE_HIGH_MIN_GRADE_A = 2;
var CONFIDENCE_MEDIUM_MIN_POINTS = 8;
var CONFIDENCE_LOW_MIN_POINTS = 5;
function computeMovingAverage(points, windowDays = DEFAULT_MA_WINDOW_DAYS) {
  if (points.length === 0) return [];
  const sorted = [...points].sort((a, b) => a.date.getTime() - b.date.getTime());
  const windowMs = windowDays * 24 * 60 * 60 * 1e3;
  return sorted.map((point) => {
    const windowStart = point.date.getTime() - windowMs;
    const windowPoints = sorted.filter(
      (p) => p.date.getTime() >= windowStart && p.date.getTime() <= point.date.getTime()
    );
    const ma = windowPoints.length > 0 ? windowPoints.reduce((sum, p) => sum + p.value, 0) / windowPoints.length : point.value;
    return {
      date: point.date,
      value: point.value,
      ma: Math.round(ma * 100) / 100
    };
  });
}
function detectDirectionChange(points, windowDays = DEFAULT_MA_WINDOW_DAYS) {
  if (points.length < 2) {
    return { direction: "insufficient_data", currentMA: null, previousMA: null, percentChange: null };
  }
  const sorted = [...points].sort((a, b) => a.date.getTime() - b.date.getTime());
  const latest = sorted[sorted.length - 1].date.getTime();
  const windowMs = windowDays * 24 * 60 * 60 * 1e3;
  const currentWindowStart = latest - windowMs;
  const currentPoints = sorted.filter(
    (p) => p.date.getTime() >= currentWindowStart && p.date.getTime() <= latest
  );
  const prevWindowStart = latest - 2 * windowMs;
  const prevPoints = sorted.filter(
    (p) => p.date.getTime() >= prevWindowStart && p.date.getTime() < currentWindowStart
  );
  if (currentPoints.length === 0) {
    return { direction: "insufficient_data", currentMA: null, previousMA: null, percentChange: null };
  }
  const currentMA = currentPoints.reduce((sum, p) => sum + p.value, 0) / currentPoints.length;
  if (prevPoints.length === 0) {
    return {
      direction: "stable",
      currentMA: Math.round(currentMA * 100) / 100,
      previousMA: null,
      percentChange: null
    };
  }
  const previousMA = prevPoints.reduce((sum, p) => sum + p.value, 0) / prevPoints.length;
  if (previousMA === 0) {
    return {
      direction: "stable",
      currentMA: Math.round(currentMA * 100) / 100,
      previousMA: 0,
      percentChange: null
    };
  }
  const percentChange = (currentMA - previousMA) / Math.abs(previousMA);
  let direction;
  if (percentChange > DIRECTION_CHANGE_THRESHOLD) {
    direction = "rising";
  } else if (percentChange < -DIRECTION_CHANGE_THRESHOLD) {
    direction = "falling";
  } else {
    direction = "stable";
  }
  return {
    direction,
    currentMA: Math.round(currentMA * 100) / 100,
    previousMA: Math.round(previousMA * 100) / 100,
    percentChange: Math.round(percentChange * 1e4) / 1e4
    // 4 decimal places
  };
}
function flagAnomalies(points, maPoints, stdDevThreshold = ANOMALY_STD_DEV_THRESHOLD) {
  if (points.length < 3 || maPoints.length === 0) return [];
  const residuals = maPoints.map((ma) => ma.value - ma.ma);
  const meanResidual = residuals.reduce((sum, r) => sum + r, 0) / residuals.length;
  const variance = residuals.reduce((sum, r) => sum + Math.pow(r - meanResidual, 2), 0) / residuals.length;
  const stdDev = Math.sqrt(variance);
  if (stdDev === 0) return [];
  const anomalies = [];
  const sorted = [...points].sort((a, b) => a.date.getTime() - b.date.getTime());
  for (let i = 0; i < sorted.length; i++) {
    const point = sorted[i];
    const maPoint = maPoints[i];
    if (!maPoint) continue;
    const deviation = Math.abs(point.value - maPoint.ma);
    const deviationMultiple = deviation / stdDev;
    if (deviationMultiple > stdDevThreshold) {
      anomalies.push({
        date: point.date,
        value: point.value,
        expectedMA: maPoint.ma,
        deviationMultiple: Math.round(deviationMultiple * 100) / 100,
        recordId: point.recordId,
        sourceId: point.sourceId
      });
    }
  }
  return anomalies;
}
function assessConfidence(dataPointCount, gradeACount) {
  if (dataPointCount >= CONFIDENCE_HIGH_MIN_POINTS && gradeACount >= CONFIDENCE_HIGH_MIN_GRADE_A) {
    return "high";
  }
  if (dataPointCount >= CONFIDENCE_MEDIUM_MIN_POINTS) {
    return "medium";
  }
  if (dataPointCount >= CONFIDENCE_LOW_MIN_POINTS) {
    return "low";
  }
  return "insufficient";
}
async function generateTrendNarrative(trend) {
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: "You are a real estate market analyst. Write exactly 3 sentences summarizing a market trend. Be factual and concise. Do not add opinions or recommendations."
        },
        {
          role: "user",
          content: `Summarize this trend:
Metric: ${trend.metric}
Category: ${trend.category}
Geography: ${trend.geography}
Direction: ${trend.direction}
Current 30-day average: ${trend.currentMA ?? "N/A"}
Previous 30-day average: ${trend.previousMA ?? "N/A"}
Change: ${trend.percentChange !== null ? `${(trend.percentChange * 100).toFixed(1)}%` : "N/A"}
Data points: ${trend.dataPointCount} (${trend.gradeACount} Grade A, ${trend.gradeBCount} Grade B, ${trend.gradeCCount} Grade C)
Sources: ${trend.uniqueSources}
Anomalies: ${trend.anomalies.length}
Date range: ${trend.dateRange ? `${trend.dateRange.start.toISOString().split("T")[0]} to ${trend.dateRange.end.toISOString().split("T")[0]}` : "N/A"}
Confidence: ${trend.confidence}`
        }
      ]
    });
    const content = response.choices?.[0]?.message?.content;
    return typeof content === "string" ? content.trim() : "";
  } catch (err) {
    console.error("[TrendDetection] Narrative generation failed:", err);
    return "";
  }
}
async function detectTrends(metric, category, geography, points, options) {
  const windowDays = options?.windowDays ?? DEFAULT_MA_WINDOW_DAYS;
  const shouldGenerateNarrative = options?.generateNarrative ?? true;
  const gradeACount = points.filter((p) => p.grade === "A").length;
  const gradeBCount = points.filter((p) => p.grade === "B").length;
  const gradeCCount = points.filter((p) => p.grade === "C").length;
  const uniqueSources = new Set(points.map((p) => p.sourceId)).size;
  const sorted = [...points].sort((a, b) => a.date.getTime() - b.date.getTime());
  const dateRange = sorted.length > 0 ? { start: sorted[0].date, end: sorted[sorted.length - 1].date } : null;
  const maPoints = computeMovingAverage(points, windowDays);
  const { direction, currentMA, previousMA, percentChange } = detectDirectionChange(
    points,
    windowDays
  );
  const anomalies = flagAnomalies(points, maPoints);
  const confidence = assessConfidence(points.length, gradeACount);
  const partialResult = {
    metric,
    category,
    geography,
    dataPointCount: points.length,
    gradeACount,
    gradeBCount,
    gradeCCount,
    uniqueSources,
    dateRange,
    currentMA,
    previousMA,
    percentChange,
    direction,
    anomalies,
    confidence
  };
  let narrative = null;
  if (shouldGenerateNarrative && points.length >= CONFIDENCE_LOW_MIN_POINTS) {
    narrative = await generateTrendNarrative(partialResult);
  }
  return {
    ...partialResult,
    narrative,
    movingAverages: maPoints
  };
}

// server/engines/ingestion/orchestrator.ts
import { and as and3, eq as eq5, sql as sql3 } from "drizzle-orm";
var MAX_CONCURRENT = 3;
async function runWithConcurrencyLimit(tasks, limit) {
  const results = [];
  let index = 0;
  async function runNext() {
    while (index < tasks.length) {
      const currentIndex = index++;
      results[currentIndex] = await tasks[currentIndex]();
    }
  }
  const workers = Array.from(
    { length: Math.min(limit, tasks.length) },
    () => runNext()
  );
  await Promise.all(workers);
  return results;
}
async function isDuplicate(sourceUrl, itemName, captureDate) {
  const db = await getDb();
  if (!db) return false;
  const existing = await db.select({ id: evidenceRecords.id }).from(evidenceRecords).where(
    and3(
      eq5(evidenceRecords.sourceUrl, sourceUrl),
      eq5(evidenceRecords.itemName, itemName),
      sql3`DATE(${evidenceRecords.captureDate}) = DATE(${captureDate})`
    )
  ).limit(1);
  return existing.length > 0;
}
var CATEGORY_MAP = {
  material_cost: "other",
  fitout_rate: "other",
  market_trend: "other",
  competitor_project: "other",
  floors: "floors",
  walls: "walls",
  ceilings: "ceilings",
  joinery: "joinery",
  lighting: "lighting",
  sanitary: "sanitary",
  kitchen: "kitchen",
  hardware: "hardware",
  ffe: "ffe",
  other: "other"
};
function mapCategory(category) {
  return CATEGORY_MAP[category] || "other";
}
var recordCounter = 0;
function generateRecordId() {
  recordCounter++;
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 6);
  return `MYR-PE-${ts}-${rand}`.toUpperCase();
}
async function runIngestion(connectors, triggeredBy = "manual", actorId) {
  const runId = `ING-${randomUUID2().substring(0, 8)}`;
  const startedAt = /* @__PURE__ */ new Date();
  const connectorResults = [];
  try {
    const db = await getDb();
    if (db) {
      for (const connector of connectors) {
        const rows = await db.select({ lastSuccessfulFetch: sourceRegistry.lastSuccessfulFetch }).from(sourceRegistry).where(eq5(sourceRegistry.name, connector.sourceId)).limit(1);
        if (rows.length > 0 && rows[0].lastSuccessfulFetch) {
          connector.lastSuccessfulFetch = rows[0].lastSuccessfulFetch;
        }
      }
    }
  } catch (err) {
    console.warn("[Ingestion] Failed to load lastSuccessfulFetch:", err);
  }
  const tasks = connectors.map((connector) => async () => {
    try {
      const raw = await connector.fetch();
      if (raw.error && raw.statusCode === 0) {
        return {
          sourceId: connector.sourceId,
          sourceName: connector.sourceName,
          status: "failed",
          evidenceExtracted: 0,
          evidenceCreated: 0,
          evidenceSkipped: 0,
          error: raw.error
        };
      }
      if (raw.statusCode >= 400) {
        return {
          sourceId: connector.sourceId,
          sourceName: connector.sourceName,
          status: "failed",
          evidenceExtracted: 0,
          evidenceCreated: 0,
          evidenceSkipped: 0,
          error: raw.error || `HTTP ${raw.statusCode}`
        };
      }
      let extracted;
      try {
        extracted = await connector.extract(raw);
      } catch (err) {
        return {
          sourceId: connector.sourceId,
          sourceName: connector.sourceName,
          status: "failed",
          evidenceExtracted: 0,
          evidenceCreated: 0,
          evidenceSkipped: 0,
          error: `Extract failed: ${err instanceof Error ? err.message : String(err)}`
        };
      }
      const validExtracted = extracted.filter((e) => {
        const result = extractedEvidenceSchema.safeParse(e);
        return result.success;
      });
      let created = 0;
      let skipped = 0;
      for (const evidence of validExtracted) {
        try {
          let normalized;
          try {
            normalized = await connector.normalize(evidence);
          } catch (err) {
            normalized = {
              metric: evidence.title,
              value: null,
              unit: null,
              confidence: 0.2,
              grade: "C",
              summary: evidence.rawText.substring(0, 500),
              tags: []
            };
          }
          const validationResult = normalizedEvidenceInputSchema.safeParse(normalized);
          if (!validationResult.success) {
            normalized = {
              metric: evidence.title || "Unknown metric",
              value: null,
              unit: null,
              confidence: 0.2,
              grade: "C",
              summary: evidence.rawText.substring(0, 500) || "Extraction failed",
              tags: []
            };
          }
          const captureDate = evidence.publishedDate || raw.fetchedAt;
          const duplicate = await isDuplicate(
            evidence.sourceUrl,
            normalized.metric,
            captureDate
          );
          if (duplicate) {
            skipped++;
            continue;
          }
          const { id: newRecordId } = await createEvidenceRecord({
            recordId: generateRecordId(),
            sourceRegistryId: typeof connector.sourceId === "number" ? connector.sourceId : parseInt(connector.sourceId) || void 0,
            sourceUrl: evidence.sourceUrl,
            category: mapCategory(evidence.category),
            itemName: normalized.metric,
            priceTypical: normalized.value?.toString() ?? null,
            unit: normalized.unit || "unit",
            currencyOriginal: "AED",
            captureDate,
            reliabilityGrade: normalized.grade,
            confidenceScore: Math.round(normalized.confidence * 100),
            extractedSnippet: normalized.summary,
            publisher: connector.sourceName,
            title: evidence.title,
            tags: normalized.tags,
            notes: `Auto-ingested from ${connector.sourceName} via V2 ingestion engine`,
            runId
          });
          const insertedRecord = await getEvidenceRecordById(newRecordId);
          if (insertedRecord) {
            await detectPriceChange(insertedRecord);
          }
          created++;
        } catch (err) {
          console.error(`[Ingestion] Record persist failed for ${connector.sourceId}:`, err);
        }
      }
      return {
        sourceId: connector.sourceId,
        sourceName: connector.sourceName,
        status: "success",
        evidenceExtracted: validExtracted.length,
        evidenceCreated: created,
        evidenceSkipped: skipped
      };
    } catch (err) {
      return {
        sourceId: connector.sourceId,
        sourceName: connector.sourceName,
        status: "failed",
        evidenceExtracted: 0,
        evidenceCreated: 0,
        evidenceSkipped: 0,
        error: `Unhandled: ${err instanceof Error ? err.message : String(err)}`
      };
    }
  });
  const results = await runWithConcurrencyLimit(tasks, MAX_CONCURRENT);
  connectorResults.push(...results);
  for (const result of connectorResults) {
    try {
      const healthStatus = result.status === "success" ? result.evidenceCreated > 0 ? "success" : "partial" : "failed";
      let errorType = null;
      if (result.error) {
        if (result.error.includes("ENOTFOUND") || result.error.includes("DNS") || result.error.includes("resolve")) {
          errorType = "dns_failure";
        } else if (result.error.includes("timeout") || result.error.includes("ETIMEDOUT")) {
          errorType = "timeout";
        } else if (result.error.includes("HTTP")) {
          errorType = "http_error";
        } else if (result.error.includes("Extract") || result.error.includes("parse")) {
          errorType = "parse_error";
        } else if (result.error.includes("LLM") || result.error.includes("invokeLLM")) {
          errorType = "llm_error";
        } else {
          errorType = "unknown";
        }
      }
      await insertConnectorHealth({
        runId,
        sourceId: result.sourceId,
        sourceName: result.sourceName,
        status: healthStatus,
        httpStatusCode: null,
        responseTimeMs: null,
        recordsExtracted: result.evidenceExtracted,
        recordsInserted: result.evidenceCreated,
        duplicatesSkipped: result.evidenceSkipped,
        errorMessage: result.error || null,
        errorType
      });
    } catch (err) {
      console.error(`[Ingestion] Failed to record health for ${result.sourceId}:`, err);
    }
  }
  try {
    const db = await getDb();
    if (db) {
      for (const result of connectorResults) {
        const current = await db.select({ consecutiveFailures: sourceRegistry.consecutiveFailures }).from(sourceRegistry).where(eq5(sourceRegistry.name, result.sourceId)).limit(1);
        const currentFailures = current.length > 0 ? current[0].consecutiveFailures : 0;
        const isSuccess = result.status === "success";
        const statusEnum = isSuccess ? result.evidenceExtracted > 0 ? "success" : "partial" : "failed";
        const updates = {
          lastScrapedAt: /* @__PURE__ */ new Date(),
          lastScrapedStatus: statusEnum,
          lastRecordCount: result.evidenceCreated,
          consecutiveFailures: isSuccess ? 0 : currentFailures + 1
        };
        if (isSuccess) {
          updates.lastSuccessfulFetch = /* @__PURE__ */ new Date();
        }
        await db.update(sourceRegistry).set(updates).where(eq5(sourceRegistry.name, result.sourceId));
      }
    }
  } catch (err) {
    console.warn("[Ingestion] Failed to update sourceRegistry metrics:", err);
  }
  const completedAt = /* @__PURE__ */ new Date();
  const durationMs = completedAt.getTime() - startedAt.getTime();
  const succeeded = connectorResults.filter((r) => r.status === "success").length;
  const failed = connectorResults.filter((r) => r.status === "failed").length;
  const totalCreated = connectorResults.reduce((sum, r) => sum + r.evidenceCreated, 0);
  const totalSkipped = connectorResults.reduce((sum, r) => sum + r.evidenceSkipped, 0);
  const errors = connectorResults.filter((r) => r.status === "failed" && r.error).map((r) => ({
    sourceId: r.sourceId,
    sourceName: r.sourceName,
    error: r.error
  }));
  try {
    const db = await getDb();
    if (db) {
      await db.insert(ingestionRuns).values({
        runId,
        trigger: triggeredBy,
        triggeredBy: actorId ?? null,
        status: failed === connectors.length ? "failed" : "completed",
        totalSources: connectors.length,
        sourcesSucceeded: succeeded,
        sourcesFailed: failed,
        recordsExtracted: connectorResults.reduce((sum, r) => sum + r.evidenceExtracted, 0),
        recordsInserted: totalCreated,
        duplicatesSkipped: totalSkipped,
        sourceBreakdown: connectorResults.map((r) => ({
          sourceId: r.sourceId,
          name: r.sourceName,
          status: r.status,
          extracted: r.evidenceExtracted,
          inserted: r.evidenceCreated,
          duplicates: r.evidenceSkipped,
          error: r.error || null
        })),
        errorSummary: errors.length > 0 ? errors : null,
        startedAt,
        completedAt,
        durationMs
      });
    }
  } catch (err) {
    console.error("[Ingestion] Failed to persist ingestion run:", err);
  }
  try {
    await createIntelligenceAuditEntry({
      runType: "price_extraction",
      runId,
      actor: actorId ?? null,
      inputSummary: {
        triggeredBy,
        connectorCount: connectors.length,
        connectorIds: connectors.map((c) => c.sourceId)
      },
      outputSummary: {
        sourcesAttempted: connectors.length,
        sourcesSucceeded: succeeded,
        sourcesFailed: failed,
        evidenceCreated: totalCreated,
        evidenceSkipped: totalSkipped
      },
      sourcesProcessed: connectors.length,
      recordsExtracted: totalCreated,
      errors: failed,
      errorDetails: errors.length > 0 ? errors : null,
      startedAt,
      completedAt
    });
  } catch (err) {
    console.error("[Ingestion] Failed to log audit entry:", err);
  }
  let proposalResult = null;
  if (totalCreated > 0) {
    try {
      proposalResult = await generateBenchmarkProposals({
        actorId,
        ingestionRunId: runId
      });
      console.log(
        `[Ingestion] Post-run proposal generation: ${proposalResult.proposalsCreated} proposals created`
      );
    } catch (err) {
      console.error("[Ingestion] Post-run proposal generation failed:", err);
    }
  }
  if (totalCreated > 0) {
    try {
      const db = await getDb();
      if (db) {
        const recentEvidence = await db.select().from(evidenceRecords).orderBy(sql3`${evidenceRecords.createdAt} DESC`).limit(500);
        const categoryGroups = /* @__PURE__ */ new Map();
        for (const record of recentEvidence) {
          const value = record.priceMin ? parseFloat(String(record.priceMin)) : null;
          if (value === null || isNaN(value)) continue;
          const date = record.captureDate || record.createdAt;
          if (!date) continue;
          const category = record.category || "other";
          const grade2 = record.reliabilityGrade || "C";
          if (!categoryGroups.has(category)) categoryGroups.set(category, []);
          categoryGroups.get(category).push({
            date: new Date(date),
            value,
            grade: grade2,
            sourceId: record.sourceRegistryId ? String(record.sourceRegistryId) : "unknown",
            recordId: record.id
          });
        }
        let trendsGenerated = 0;
        for (const [category, points] of Array.from(categoryGroups.entries())) {
          if (points.length < 2) continue;
          const trend = await detectTrends(category, category, "UAE", points, {
            generateNarrative: points.length >= 5
          });
          await insertTrendSnapshot({
            metric: trend.metric,
            category: trend.category,
            geography: trend.geography,
            dataPointCount: trend.dataPointCount,
            gradeACount: trend.gradeACount,
            gradeBCount: trend.gradeBCount,
            gradeCCount: trend.gradeCCount,
            uniqueSources: trend.uniqueSources,
            dateRangeStart: trend.dateRange?.start || null,
            dateRangeEnd: trend.dateRange?.end || null,
            currentMA: trend.currentMA !== null ? String(trend.currentMA) : null,
            previousMA: trend.previousMA !== null ? String(trend.previousMA) : null,
            percentChange: trend.percentChange !== null ? String(trend.percentChange) : null,
            direction: trend.direction,
            anomalyCount: trend.anomalies.length,
            anomalyDetails: trend.anomalies.length > 0 ? trend.anomalies : null,
            confidence: trend.confidence,
            narrative: trend.narrative,
            movingAverages: trend.movingAverages.length > 0 ? trend.movingAverages : null,
            ingestionRunId: runId
          });
          trendsGenerated++;
        }
        console.log(`[Ingestion] Post-run trend detection: ${trendsGenerated} trend snapshots created`);
      }
    } catch (err) {
      console.error("[Ingestion] Post-run trend detection failed:", err);
    }
  }
  try {
    const alerts = await triggerAlertEngine();
    console.log(`[Ingestion] Post-run alert generation: ${alerts.length} new alerts created`);
  } catch (err) {
    console.error("[Ingestion] Post-run alert generation failed:", err);
  }
  const report = {
    runId,
    startedAt,
    completedAt,
    durationMs,
    triggeredBy,
    sourcesAttempted: connectors.length,
    sourcesSucceeded: succeeded,
    sourcesFailed: failed,
    evidenceCreated: totalCreated,
    evidenceSkipped: totalSkipped,
    errors,
    perSource: connectorResults
  };
  return report;
}
async function runSingleConnector(connector, triggeredBy = "manual", actorId) {
  return runIngestion([connector], triggeredBy, actorId);
}
async function testScrape(connector) {
  const startedAt = /* @__PURE__ */ new Date();
  const raw = await connector.fetch();
  if (raw.error) {
    return { success: false, error: raw.error, statusCode: raw.statusCode };
  }
  const extracted = await connector.extract(raw);
  const normalizedRecords = [];
  for (const evidence of extracted) {
    if (!extractedEvidenceSchema.safeParse(evidence).success) continue;
    try {
      const normalized = await connector.normalize(evidence);
      if (normalizedEvidenceInputSchema.safeParse(normalized).success) {
        normalizedRecords.push(normalized);
      }
    } catch {
    }
  }
  return {
    success: true,
    statusCode: raw.statusCode,
    rawPayloadSize: (raw.rawHtml?.length || 0) + JSON.stringify(raw.rawJson || {}).length,
    extractedCount: extracted.length,
    validNormalizedCount: normalizedRecords.length,
    previewRecords: normalizedRecords.slice(0, 5),
    durationMs: (/* @__PURE__ */ new Date()).getTime() - startedAt.getTime()
  };
}

// server/engines/ingestion/csv-pipeline.ts
import * as xlsx from "xlsx";
function generateRecordId2() {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 6);
  return `MYR-PE-CSV-${ts}-${rand}`.toUpperCase();
}
function generateCsvTemplate() {
  const wsData = [
    ["Item Name", "Category", "Region", "Metric", "Value", "Unit", "Date (YYYY-MM-DD)", "Tags", "Notes"],
    ["Sample Tile 60x60", "material_cost", "Dubai", "Price per SQM", "125.50", "sqm", "2026-02-01", "ceramics, flooring", "Premium finish"]
  ];
  const ws = xlsx.utils.aoa_to_sheet(wsData);
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, ws, "Upload Template");
  return xlsx.write(wb, { type: "buffer", bookType: "xlsx" });
}
async function processCsvUpload(buffer, sourceId, addedByUserId) {
  const source = await getSourceRegistryById(sourceId);
  if (!source) throw new Error("Source not found");
  const wb = xlsx.read(buffer, { type: "buffer" });
  if (!wb.SheetNames.length) throw new Error("Empty spreadsheet");
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rawData = xlsx.utils.sheet_to_json(ws);
  if (rawData.length === 0) {
    throw new Error("No data found in rows");
  }
  let successCount = 0;
  let skippedCount = 0;
  const errors = [];
  for (let i = 0; i < rawData.length; i++) {
    const row = rawData[i];
    try {
      const title = row["Item Name"] || row["Title"] || row["Name"];
      const category = row["Category"] || row["category"] || source.sourceType || "other";
      const geography = row["Region"] || row["Geography"] || source.region || "UAE";
      const metric = row["Metric"] || row["metric"] || title;
      const valRaw = row["Value"] || row["Price"] || row["Cost"];
      const value = parseFloat(valRaw);
      const unit = row["Unit"] || row["unit"] || "unit";
      const dateRaw = row["Date (YYYY-MM-DD)"] || row["Date"] || row["date"];
      let publishedDate = /* @__PURE__ */ new Date();
      if (dateRaw) {
        const parsed = new Date(dateRaw);
        if (!isNaN(parsed.getTime())) publishedDate = parsed;
      }
      const tagsRaw = row["Tags"] || row["tags"];
      const tags = tagsRaw && typeof tagsRaw === "string" ? tagsRaw.split(",").map((s) => s.trim()).filter(Boolean) : [];
      const notes = row["Notes"] || row["notes"] || "";
      if (!title) {
        errors.push(`Row ${i + 2}: Missing Item Name/Title`);
        skippedCount++;
        continue;
      }
      if (isNaN(value)) {
        errors.push(`Row ${i + 2}: Invalid or missing numeric Value`);
        skippedCount++;
        continue;
      }
      const summary = notes ? `Uploaded Data: ${notes}` : `Bulk uploaded value for ${title}`;
      const { id: newRecordId } = await createEvidenceRecord({
        recordId: generateRecordId2(),
        sourceRegistryId: source.id,
        sourceUrl: source.url,
        category: String(category).substring(0, 64),
        itemName: String(title).substring(0, 255),
        title: String(metric).substring(0, 512),
        // mapping metric to title for context
        priceTypical: isNaN(value) ? null : value.toString(),
        unit: String(unit).substring(0, 32),
        currencyOriginal: "AED",
        captureDate: publishedDate,
        reliabilityGrade: source.reliabilityDefault,
        confidenceScore: source.reliabilityDefault === "A" ? 90 : 70,
        // 0-100 scale
        extractedSnippet: summary.substring(0, 500),
        publisher: source.name,
        tags,
        notes: `Uploaded via CSV bulk tool. Row context: ${JSON.stringify(row).substring(0, 200)}`,
        createdBy: addedByUserId
      });
      const insertedRecord = await getEvidenceRecordById(newRecordId);
      if (insertedRecord) {
        await detectPriceChange(insertedRecord);
      }
      successCount++;
    } catch (e) {
      errors.push(`Row ${i + 2}: ${e.message}`);
      skippedCount++;
    }
  }
  return {
    totalRows: rawData.length,
    successCount,
    skippedCount,
    errors: errors.slice(0, 10)
    // only return top 10 errors
  };
}

// server/routers/market-intelligence.ts
var evidenceRecordSchema = z9.object({
  projectId: z9.number().optional(),
  sourceRegistryId: z9.number().optional(),
  category: z9.enum([
    "floors",
    "walls",
    "ceilings",
    "joinery",
    "lighting",
    "sanitary",
    "kitchen",
    "hardware",
    "ffe",
    "other"
  ]),
  itemName: z9.string().min(1),
  specClass: z9.string().optional(),
  priceMin: z9.number().optional(),
  priceTypical: z9.number().optional(),
  priceMax: z9.number().optional(),
  unit: z9.string().min(1),
  currencyOriginal: z9.string().default("AED"),
  currencyAed: z9.number().optional(),
  fxRate: z9.number().optional(),
  fxSource: z9.string().optional(),
  sourceUrl: z9.string().url(),
  publisher: z9.string().optional(),
  captureDate: z9.string(),
  // ISO date
  reliabilityGrade: z9.enum(["A", "B", "C"]),
  confidenceScore: z9.number().min(0).max(100),
  extractedSnippet: z9.string().optional(),
  notes: z9.string().optional(),
  // V2.2 metadata fields
  title: z9.string().optional(),
  evidencePhase: z9.enum(["concept", "schematic", "detailed_design", "tender", "procurement", "construction", "handover"]).optional(),
  author: z9.string().optional(),
  confidentiality: z9.enum(["public", "internal", "confidential", "restricted"]).default("internal"),
  tags: z9.array(z9.string()).optional(),
  fileUrl: z9.string().optional(),
  fileKey: z9.string().optional(),
  fileMimeType: z9.string().optional()
});
var sourceRegistrySchema = z9.object({
  name: z9.string().min(1),
  url: z9.string().url(),
  sourceType: z9.enum([
    "supplier_catalog",
    "manufacturer_catalog",
    "developer_brochure",
    "industry_report",
    "government_tender",
    "procurement_portal",
    "trade_publication",
    "retailer_listing",
    "aggregator",
    "other"
  ]),
  reliabilityDefault: z9.enum(["A", "B", "C"]).default("B"),
  isWhitelisted: z9.boolean().default(true),
  region: z9.string().default("UAE"),
  notes: z9.string().optional(),
  // DFE Fields
  scrapeConfig: z9.any().optional(),
  scrapeSchedule: z9.string().optional(),
  scrapeMethod: z9.enum(["html_llm", "html_rules", "json_api", "rss_feed", "csv_upload", "email_forward"]).default("html_llm"),
  scrapeHeaders: z9.any().optional(),
  extractionHints: z9.string().optional(),
  priceFieldMapping: z9.any().optional(),
  lastScrapedAt: z9.string().optional(),
  lastScrapedStatus: z9.enum(["success", "partial", "failed", "never"]).default("never"),
  lastRecordCount: z9.number().default(0),
  consecutiveFailures: z9.number().default(0),
  requestDelayMs: z9.number().default(2e3)
});
function generateRecordId3() {
  const seq = nanoid4(8).toUpperCase();
  return `MYR-PE-${seq}`;
}
function generateRunId(prefix) {
  return `${prefix}-${Date.now()}-${nanoid4(6)}`;
}
var marketIntelligenceRouter = router({
  // ─── Source Registry ────────────────────────────────────────────────────────
  sources: router({
    list: protectedProcedure.query(async () => {
      return listSourceRegistry();
    }),
    get: protectedProcedure.input(z9.object({ id: z9.number() })).query(async ({ input }) => {
      return getSourceRegistryById(input.id);
    }),
    create: adminProcedure.input(sourceRegistrySchema).mutation(async ({ input, ctx }) => {
      const { lastScrapedAt, ...rest } = input;
      const result = await createSourceRegistryEntry({
        ...rest,
        lastScrapedAt: lastScrapedAt ? new Date(lastScrapedAt) : void 0,
        addedBy: ctx.user.id
      });
      await createAuditLog({
        userId: ctx.user.id,
        action: "source_registry.create",
        entityType: "source_registry",
        entityId: result.id
      });
      return result;
    }),
    update: adminProcedure.input(z9.object({
      id: z9.number(),
      name: z9.string().optional(),
      url: z9.string().url().optional(),
      sourceType: z9.enum([
        "supplier_catalog",
        "manufacturer_catalog",
        "developer_brochure",
        "industry_report",
        "government_tender",
        "procurement_portal",
        "trade_publication",
        "retailer_listing",
        "aggregator",
        "other"
      ]).optional(),
      reliabilityDefault: z9.enum(["A", "B", "C"]).optional(),
      isWhitelisted: z9.boolean().optional(),
      region: z9.string().optional(),
      notes: z9.string().optional(),
      isActive: z9.boolean().optional(),
      // DFE Fields
      scrapeConfig: z9.any().optional(),
      scrapeSchedule: z9.string().optional(),
      scrapeMethod: z9.enum(["html_llm", "html_rules", "json_api", "rss_feed", "csv_upload", "email_forward"]).optional(),
      scrapeHeaders: z9.any().optional(),
      extractionHints: z9.string().optional(),
      priceFieldMapping: z9.any().optional(),
      lastScrapedAt: z9.string().optional(),
      lastScrapedStatus: z9.enum(["success", "partial", "failed", "never"]).optional(),
      lastRecordCount: z9.number().optional(),
      consecutiveFailures: z9.number().optional(),
      requestDelayMs: z9.number().optional()
    })).mutation(async ({ input, ctx }) => {
      const { id, lastScrapedAt, ...data } = input;
      await updateSourceRegistryEntry(id, {
        ...data,
        lastScrapedAt: lastScrapedAt ? new Date(lastScrapedAt) : void 0
      });
      await createAuditLog({
        userId: ctx.user.id,
        action: "source_registry.update",
        entityType: "source_registry",
        entityId: id,
        details: data.isActive !== void 0 ? { isActive: data.isActive } : void 0
      });
      return { success: true };
    }),
    toggleActive: adminProcedure.input(z9.object({ id: z9.number(), isActive: z9.boolean() })).mutation(async ({ input, ctx }) => {
      await updateSourceRegistryEntry(input.id, { isActive: input.isActive });
      await createAuditLog({
        userId: ctx.user.id,
        action: input.isActive ? "source_registry.enable" : "source_registry.disable",
        entityType: "source_registry",
        entityId: input.id
      });
      return { success: true };
    }),
    delete: adminProcedure.input(z9.object({ id: z9.number() })).mutation(async ({ input, ctx }) => {
      await deleteSourceRegistryEntry(input.id);
      await createAuditLog({
        userId: ctx.user.id,
        action: "source_registry.delete",
        entityType: "source_registry",
        entityId: input.id
      });
      return { success: true };
    }),
    seedDefaults: adminProcedure.mutation(async ({ ctx }) => {
      const defaults = getDefaultSources();
      let created = 0;
      for (const src of defaults) {
        await createSourceRegistryEntry({ ...src, addedBy: ctx.user.id });
        created++;
      }
      await createAuditLog({
        userId: ctx.user.id,
        action: "source_registry.seed_defaults",
        entityType: "source_registry",
        details: { count: created }
      });
      return { created };
    }),
    testScrape: adminProcedure.input(z9.object({ id: z9.number() })).mutation(async ({ input }) => {
      const source = await getSourceRegistryById(input.id);
      if (!source) throw new Error("Source not found");
      const connector = new DynamicConnector(source);
      return await testScrape(connector);
    }),
    scrapeNow: adminProcedure.input(z9.object({ id: z9.number() })).mutation(async ({ input, ctx }) => {
      const source = await getSourceRegistryById(input.id);
      if (!source) throw new Error("Source not found");
      await updateSourceRegistryEntry(source.id, { consecutiveFailures: 0 });
      const connector = new DynamicConnector(source);
      const report = await runSingleConnector(connector, "manual", ctx.user.id);
      const isSuccess = report.sourcesSucceeded > 0;
      await updateSourceRegistryEntry(source.id, {
        lastScrapedAt: /* @__PURE__ */ new Date(),
        lastScrapedStatus: isSuccess ? "success" : "failed",
        lastRecordCount: report.evidenceCreated,
        consecutiveFailures: isSuccess ? 0 : (source.consecutiveFailures || 0) + 1
      });
      return report;
    }),
    downloadCsvTemplate: adminProcedure.mutation(async () => {
      const buffer = generateCsvTemplate();
      return { base64: buffer.toString("base64") };
    }),
    uploadCsv: adminProcedure.input(z9.object({
      sourceId: z9.number(),
      base64File: z9.string()
    })).mutation(async ({ input, ctx }) => {
      const buffer = Buffer.from(input.base64File, "base64");
      const report = await processCsvUpload(buffer, input.sourceId, ctx.user.id);
      const isSuccess = report.successCount > 0;
      await updateSourceRegistryEntry(input.sourceId, {
        lastScrapedAt: /* @__PURE__ */ new Date(),
        lastScrapedStatus: isSuccess ? "success" : "failed",
        lastRecordCount: report.successCount,
        consecutiveFailures: isSuccess ? 0 : 1
      });
      return report;
    })
  }),
  // ─── Evidence Records ──────────────────────────────────────────────────────
  evidence: router({
    list: protectedProcedure.input(z9.object({
      projectId: z9.number().optional(),
      category: z9.string().optional(),
      reliabilityGrade: z9.string().optional(),
      evidencePhase: z9.string().optional(),
      confidentiality: z9.string().optional(),
      limit: z9.number().default(100)
    }).optional()).query(async ({ input }) => {
      return listEvidenceRecords({
        projectId: input?.projectId,
        category: input?.category,
        reliabilityGrade: input?.reliabilityGrade,
        evidencePhase: input?.evidencePhase,
        confidentiality: input?.confidentiality,
        limit: input?.limit ?? 100
      });
    }),
    get: protectedProcedure.input(z9.object({ id: z9.number() })).query(async ({ input }) => {
      return getEvidenceRecordById(input.id);
    }),
    create: adminProcedure.input(evidenceRecordSchema).mutation(async ({ input, ctx }) => {
      const recordId = generateRecordId3();
      const result = await createEvidenceRecord({
        ...input,
        recordId,
        priceMin: input.priceMin ? String(input.priceMin) : null,
        priceTypical: input.priceTypical ? String(input.priceTypical) : null,
        priceMax: input.priceMax ? String(input.priceMax) : null,
        currencyAed: input.currencyAed ? String(input.currencyAed) : null,
        fxRate: input.fxRate ? String(input.fxRate) : null,
        captureDate: new Date(input.captureDate),
        createdBy: ctx.user.id
      });
      await createIntelligenceAuditEntry({
        runType: "manual_entry",
        runId: generateRunId("MAN"),
        actor: ctx.user.id,
        inputSummary: { category: input.category, itemName: input.itemName },
        outputSummary: { recordId, evidenceId: result.id },
        sourcesProcessed: 1,
        recordsExtracted: 1,
        errors: 0,
        startedAt: /* @__PURE__ */ new Date(),
        completedAt: /* @__PURE__ */ new Date()
      });
      return { id: result.id, recordId };
    }),
    bulkImport: adminProcedure.input(z9.object({
      records: z9.array(evidenceRecordSchema)
    })).mutation(async ({ input, ctx }) => {
      const runId = generateRunId("BULK");
      const startedAt = /* @__PURE__ */ new Date();
      let imported = 0;
      const errors = [];
      for (let i = 0; i < input.records.length; i++) {
        try {
          const rec = input.records[i];
          const recordId = generateRecordId3();
          await createEvidenceRecord({
            ...rec,
            recordId,
            priceMin: rec.priceMin ? String(rec.priceMin) : null,
            priceTypical: rec.priceTypical ? String(rec.priceTypical) : null,
            priceMax: rec.priceMax ? String(rec.priceMax) : null,
            currencyAed: rec.currencyAed ? String(rec.currencyAed) : null,
            fxRate: rec.fxRate ? String(rec.fxRate) : null,
            captureDate: new Date(rec.captureDate),
            runId,
            createdBy: ctx.user.id
          });
          imported++;
        } catch (e) {
          errors.push({ index: i, error: e.message });
        }
      }
      await createIntelligenceAuditEntry({
        runType: "price_extraction",
        runId,
        actor: ctx.user.id,
        inputSummary: { totalRecords: input.records.length },
        outputSummary: { imported, errors: errors.length },
        sourcesProcessed: input.records.length,
        recordsExtracted: imported,
        errors: errors.length,
        errorDetails: errors.length > 0 ? errors : void 0,
        startedAt,
        completedAt: /* @__PURE__ */ new Date()
      });
      return { imported, errors: errors.length, runId };
    }),
    delete: adminProcedure.input(z9.object({ id: z9.number() })).mutation(async ({ input, ctx }) => {
      await deleteEvidenceRecord(input.id);
      await createAuditLog({
        userId: ctx.user.id,
        action: "evidence_record.delete",
        entityType: "evidence_record",
        entityId: input.id
      });
      return { success: true };
    }),
    stats: protectedProcedure.query(async () => {
      return getEvidenceStats();
    }),
    // V2.2 — Evidence References
    listReferences: protectedProcedure.input(z9.object({
      evidenceRecordId: z9.number().optional(),
      targetType: z9.string().optional(),
      targetId: z9.number().optional()
    })).query(async ({ input }) => {
      return listEvidenceReferences(input);
    }),
    addReference: adminProcedure.input(z9.object({
      evidenceRecordId: z9.number(),
      targetType: z9.enum([
        "scenario",
        "decision_note",
        "explainability_driver",
        "design_brief",
        "report",
        "material_board",
        "pack_section"
      ]),
      targetId: z9.number(),
      sectionLabel: z9.string().optional(),
      citationText: z9.string().optional()
    })).mutation(async ({ input, ctx }) => {
      const result = await createEvidenceReference({ ...input, addedBy: ctx.user.id });
      await createAuditLog({
        userId: ctx.user.id,
        action: "evidence_reference.create",
        entityType: "evidence_reference",
        entityId: result.id
      });
      return result;
    }),
    removeReference: adminProcedure.input(z9.object({ id: z9.number() })).mutation(async ({ input, ctx }) => {
      await deleteEvidenceReference(input.id);
      await createAuditLog({
        userId: ctx.user.id,
        action: "evidence_reference.delete",
        entityType: "evidence_reference",
        entityId: input.id
      });
      return { success: true };
    }),
    // Get evidence records linked to a specific target (e.g., scenario, design_brief)
    getForTarget: protectedProcedure.input(z9.object({
      targetType: z9.string(),
      targetId: z9.number()
    })).query(async ({ input }) => {
      return getEvidenceForTarget(input.targetType, input.targetId);
    })
  }),
  // ─── Benchmark Proposals ──────────────────────────────────────────────────
  proposals: router({
    list: adminProcedure.input(z9.object({
      status: z9.enum(["pending", "approved", "rejected"]).optional()
    }).optional()).query(async ({ input }) => {
      return listBenchmarkProposals(input?.status);
    }),
    get: adminProcedure.input(z9.object({ id: z9.number() })).query(async ({ input }) => {
      return getBenchmarkProposalById(input.id);
    }),
    generate: adminProcedure.input(z9.object({
      category: z9.string().optional(),
      minEvidenceCount: z9.number().default(3)
    })).mutation(async ({ input, ctx }) => {
      const runId = generateRunId("PROP");
      const startedAt = /* @__PURE__ */ new Date();
      const evidence = await listEvidenceRecords({
        category: input.category,
        limit: 1e4
      });
      if (evidence.length === 0) {
        return { proposals: [], message: "No evidence records found to generate proposals from." };
      }
      const groups = /* @__PURE__ */ new Map();
      for (const rec of evidence) {
        const key = `${rec.category}:${rec.unit}`;
        const existing = groups.get(key) ?? [];
        existing.push(rec);
        groups.set(key, existing);
      }
      const proposals = [];
      let proposalsCreated = 0;
      for (const [benchmarkKey, records] of Array.from(groups.entries())) {
        if (records.length < input.minEvidenceCount) continue;
        const prices = records.map((r) => Number(r.priceTypical ?? r.currencyAed ?? 0)).filter((p) => p > 0).sort((a, b) => a - b);
        if (prices.length === 0) continue;
        const p25 = prices[Math.floor(prices.length * 0.25)] ?? prices[0];
        const p50 = prices[Math.floor(prices.length * 0.5)] ?? prices[0];
        const p75 = prices[Math.floor(prices.length * 0.75)] ?? prices[prices.length - 1];
        const weightMap = { A: 3, B: 2, C: 1 };
        let weightedSum = 0;
        let totalWeight = 0;
        for (const rec of records) {
          const price = Number(rec.priceTypical ?? rec.currencyAed ?? 0);
          if (price <= 0) continue;
          const w = weightMap[rec.reliabilityGrade] ?? 1;
          weightedSum += price * w;
          totalWeight += w;
        }
        const weightedMean = totalWeight > 0 ? weightedSum / totalWeight : p50;
        const reliabilityDist = { A: 0, B: 0, C: 0 };
        for (const rec of records) {
          reliabilityDist[rec.reliabilityGrade]++;
        }
        const now = Date.now();
        const recencyDist = { recent: 0, mid: 0, old: 0 };
        for (const rec of records) {
          const age = now - new Date(rec.captureDate).getTime();
          const months = age / (30 * 24 * 60 * 60 * 1e3);
          if (months <= 3) recencyDist.recent++;
          else if (months <= 12) recencyDist.mid++;
          else recencyDist.old++;
        }
        const uniqueSources = new Set(records.map((r) => r.sourceRegistryId ?? r.sourceUrl));
        const sourceDiversity = uniqueSources.size;
        let confidence = 50;
        if (records.length >= 10) confidence += 15;
        else if (records.length >= 5) confidence += 10;
        if (sourceDiversity >= 3) confidence += 15;
        else if (sourceDiversity >= 2) confidence += 10;
        if (reliabilityDist.A >= records.length * 0.5) confidence += 10;
        if (recencyDist.recent >= records.length * 0.5) confidence += 10;
        confidence = Math.min(100, confidence);
        const minSampleSize = 5;
        const minSourceDiversity = 2;
        let recommendation = "publish";
        let rejectionReason;
        if (records.length < minSampleSize) {
          recommendation = "reject";
          rejectionReason = `Insufficient sample size: ${records.length} < ${minSampleSize}`;
        } else if (sourceDiversity < minSourceDiversity) {
          recommendation = "reject";
          rejectionReason = `Insufficient source diversity: ${sourceDiversity} < ${minSourceDiversity}`;
        } else if (confidence < 40) {
          recommendation = "reject";
          rejectionReason = `Low confidence score: ${confidence}`;
        }
        const result = await createBenchmarkProposal({
          benchmarkKey,
          proposedP25: String(p25.toFixed(2)),
          proposedP50: String(p50.toFixed(2)),
          proposedP75: String(p75.toFixed(2)),
          weightedMean: String(weightedMean.toFixed(2)),
          evidenceCount: records.length,
          sourceDiversity,
          reliabilityDist,
          recencyDist,
          confidenceScore: confidence,
          recommendation,
          rejectionReason,
          runId
        });
        proposals.push({ id: result.id, benchmarkKey, recommendation });
        proposalsCreated++;
      }
      await createIntelligenceAuditEntry({
        runType: "benchmark_proposal",
        runId,
        actor: ctx.user.id,
        inputSummary: { category: input.category, minEvidenceCount: input.minEvidenceCount, totalEvidence: evidence.length },
        outputSummary: { proposalsCreated, groups: groups.size },
        sourcesProcessed: evidence.length,
        recordsExtracted: proposalsCreated,
        errors: 0,
        startedAt,
        completedAt: /* @__PURE__ */ new Date()
      });
      return { proposals, runId };
    }),
    review: adminProcedure.input(z9.object({
      id: z9.number(),
      status: z9.enum(["approved", "rejected"]),
      reviewerNotes: z9.string().optional()
    })).mutation(async ({ input, ctx }) => {
      await reviewBenchmarkProposal(input.id, {
        status: input.status,
        reviewerNotes: input.reviewerNotes,
        reviewedBy: ctx.user.id
      });
      if (input.status === "approved") {
        const proposal = await getBenchmarkProposalById(input.id);
        if (proposal) {
          const activeBV = await getActiveBenchmarkVersion();
          const currentBenchmarks = await getAllBenchmarkData();
          await createBenchmarkSnapshot({
            benchmarkVersionId: activeBV?.id,
            snapshotJson: {
              beforeApproval: currentBenchmarks.map((b) => ({
                id: b.id,
                typology: b.typology,
                location: b.location,
                marketTier: b.marketTier,
                costPerSqftMid: b.costPerSqftMid
              })),
              approvedProposal: {
                benchmarkKey: proposal.benchmarkKey,
                proposedP50: proposal.proposedP50,
                weightedMean: proposal.weightedMean
              }
            },
            description: `Snapshot before applying proposal ${proposal.benchmarkKey}`,
            createdBy: ctx.user.id
          });
        }
      }
      await createAuditLog({
        userId: ctx.user.id,
        action: `benchmark_proposal.${input.status}`,
        entityType: "benchmark_proposal",
        entityId: input.id,
        details: { reviewerNotes: input.reviewerNotes }
      });
      return { success: true };
    })
  }),
  // ─── Benchmark Snapshots ──────────────────────────────────────────────────
  snapshots: router({
    list: adminProcedure.query(async () => {
      return listBenchmarkSnapshots();
    }),
    get: adminProcedure.input(z9.object({ id: z9.number() })).query(async ({ input }) => {
      return getBenchmarkSnapshotById(input.id);
    }),
    create: adminProcedure.input(z9.object({ description: z9.string().optional() })).mutation(async ({ ctx, input }) => {
      const activeBV = await getActiveBenchmarkVersion();
      const currentBenchmarks = await getAllBenchmarkData();
      const result = await createBenchmarkSnapshot({
        benchmarkVersionId: activeBV?.id,
        snapshotJson: currentBenchmarks,
        description: input.description ?? `Manual snapshot at ${(/* @__PURE__ */ new Date()).toISOString()}`,
        createdBy: ctx.user.id
      });
      return result;
    })
  }),
  // ─── Competitor Intelligence ──────────────────────────────────────────────
  competitors: router({
    // ─── Entities ─────────────────────────────────────────────────────────
    listEntities: protectedProcedure.query(async () => {
      return listCompetitorEntities();
    }),
    getEntity: protectedProcedure.input(z9.object({ id: z9.number() })).query(async ({ input }) => {
      return getCompetitorEntityById(input.id);
    }),
    createEntity: adminProcedure.input(z9.object({
      name: z9.string().min(1),
      headquarters: z9.string().optional(),
      segmentFocus: z9.enum(["affordable", "mid", "premium", "luxury", "ultra_luxury", "mixed"]).default("mixed"),
      website: z9.string().optional(),
      logoUrl: z9.string().optional(),
      notes: z9.string().optional()
    })).mutation(async ({ input, ctx }) => {
      const result = await createCompetitorEntity({ ...input, createdBy: ctx.user.id });
      await createAuditLog({
        userId: ctx.user.id,
        action: "competitor_entity.create",
        entityType: "competitor_entity",
        entityId: result.id
      });
      return result;
    }),
    updateEntity: adminProcedure.input(z9.object({
      id: z9.number(),
      name: z9.string().optional(),
      headquarters: z9.string().optional(),
      segmentFocus: z9.enum(["affordable", "mid", "premium", "luxury", "ultra_luxury", "mixed"]).optional(),
      website: z9.string().optional(),
      logoUrl: z9.string().optional(),
      notes: z9.string().optional()
    })).mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      await updateCompetitorEntity(id, data);
      await createAuditLog({
        userId: ctx.user.id,
        action: "competitor_entity.update",
        entityType: "competitor_entity",
        entityId: id
      });
      return { success: true };
    }),
    deleteEntity: adminProcedure.input(z9.object({ id: z9.number() })).mutation(async ({ input, ctx }) => {
      await deleteCompetitorEntity(input.id);
      await createAuditLog({
        userId: ctx.user.id,
        action: "competitor_entity.delete",
        entityType: "competitor_entity",
        entityId: input.id
      });
      return { success: true };
    }),
    // ─── Projects ─────────────────────────────────────────────────────────
    listProjects: protectedProcedure.input(z9.object({
      competitorId: z9.number().optional(),
      segment: z9.string().optional()
    }).optional()).query(async ({ input }) => {
      return listCompetitorProjects(input?.competitorId, input?.segment);
    }),
    getProject: protectedProcedure.input(z9.object({ id: z9.number() })).query(async ({ input }) => {
      return getCompetitorProjectById(input.id);
    }),
    createProject: adminProcedure.input(z9.object({
      competitorId: z9.number(),
      projectName: z9.string().min(1),
      location: z9.string().optional(),
      segment: z9.enum(["affordable", "mid", "premium", "luxury", "ultra_luxury"]).optional(),
      assetType: z9.enum(["residential", "commercial", "hospitality", "mixed_use"]).default("residential"),
      positioningKeywords: z9.array(z9.string()).optional(),
      interiorStyleSignals: z9.array(z9.string()).optional(),
      materialCues: z9.array(z9.string()).optional(),
      amenityList: z9.array(z9.string()).optional(),
      unitMix: z9.string().optional(),
      priceIndicators: z9.any().optional(),
      salesMessaging: z9.array(z9.string()).optional(),
      differentiationClaims: z9.array(z9.string()).optional(),
      completionStatus: z9.enum(["announced", "under_construction", "completed", "sold_out"]).optional(),
      launchDate: z9.string().optional(),
      totalUnits: z9.number().optional(),
      architect: z9.string().optional(),
      interiorDesigner: z9.string().optional(),
      sourceUrl: z9.string().optional(),
      captureDate: z9.string().optional(),
      evidenceCitations: z9.any().optional(),
      completenessScore: z9.number().optional()
    })).mutation(async ({ input, ctx }) => {
      const result = await createCompetitorProject({
        ...input,
        captureDate: input.captureDate ? new Date(input.captureDate) : void 0,
        createdBy: ctx.user.id
      });
      await createAuditLog({
        userId: ctx.user.id,
        action: "competitor_project.create",
        entityType: "competitor_project",
        entityId: result.id
      });
      return result;
    }),
    updateProject: adminProcedure.input(z9.object({
      id: z9.number(),
      projectName: z9.string().optional(),
      location: z9.string().optional(),
      segment: z9.enum(["affordable", "mid", "premium", "luxury", "ultra_luxury"]).optional(),
      positioningKeywords: z9.array(z9.string()).optional(),
      interiorStyleSignals: z9.array(z9.string()).optional(),
      materialCues: z9.array(z9.string()).optional(),
      amenityList: z9.array(z9.string()).optional(),
      priceIndicators: z9.any().optional(),
      salesMessaging: z9.array(z9.string()).optional(),
      differentiationClaims: z9.array(z9.string()).optional(),
      completionStatus: z9.enum(["announced", "under_construction", "completed", "sold_out"]).optional(),
      totalUnits: z9.number().optional(),
      architect: z9.string().optional(),
      interiorDesigner: z9.string().optional(),
      sourceUrl: z9.string().optional(),
      evidenceCitations: z9.any().optional(),
      completenessScore: z9.number().optional()
    })).mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      await updateCompetitorProject(id, data);
      await createAuditLog({
        userId: ctx.user.id,
        action: "competitor_project.update",
        entityType: "competitor_project",
        entityId: id
      });
      return { success: true };
    }),
    deleteProject: adminProcedure.input(z9.object({ id: z9.number() })).mutation(async ({ input, ctx }) => {
      await deleteCompetitorProject(input.id);
      await createAuditLog({
        userId: ctx.user.id,
        action: "competitor_project.delete",
        entityType: "competitor_project",
        entityId: input.id
      });
      return { success: true };
    }),
    // ─── Comparison View ──────────────────────────────────────────────────
    compare: protectedProcedure.input(z9.object({ projectIds: z9.array(z9.number()).min(2).max(6) })).query(async ({ input }) => {
      const projects2 = [];
      for (const id of input.projectIds) {
        const p = await getCompetitorProjectById(id);
        if (p) projects2.push(p);
      }
      const dimensions = [
        "segment",
        "assetType",
        "completionStatus",
        "totalUnits",
        "positioningKeywords",
        "interiorStyleSignals",
        "materialCues",
        "amenityList",
        "differentiationClaims"
      ];
      const validProjects = projects2.filter((p) => p != null);
      const matrix = dimensions.map((dim) => ({
        dimension: dim,
        values: validProjects.map((p) => ({
          projectId: p.id,
          projectName: p.projectName,
          value: p[dim]
        }))
      }));
      return { projects: validProjects, matrix };
    }),
    bulkImport: adminProcedure.input(z9.object({
      competitorId: z9.number(),
      projects: z9.array(z9.object({
        projectName: z9.string(),
        location: z9.string().optional(),
        segment: z9.enum(["affordable", "mid", "premium", "luxury", "ultra_luxury"]).optional(),
        assetType: z9.enum(["residential", "commercial", "hospitality", "mixed_use"]).default("residential"),
        positioningKeywords: z9.array(z9.string()).optional(),
        interiorStyleSignals: z9.array(z9.string()).optional(),
        materialCues: z9.array(z9.string()).optional(),
        amenityList: z9.array(z9.string()).optional(),
        sourceUrl: z9.string().optional(),
        evidenceCitations: z9.any().optional(),
        completenessScore: z9.number().optional()
      }))
    })).mutation(async ({ input, ctx }) => {
      const runId = generateRunId("COMP");
      const startedAt = /* @__PURE__ */ new Date();
      let imported = 0;
      for (const proj of input.projects) {
        await createCompetitorProject({
          ...proj,
          competitorId: input.competitorId,
          runId,
          createdBy: ctx.user.id
        });
        imported++;
      }
      await createIntelligenceAuditEntry({
        runType: "competitor_extraction",
        runId,
        actor: ctx.user.id,
        inputSummary: { competitorId: input.competitorId, projectCount: input.projects.length },
        outputSummary: { imported },
        sourcesProcessed: input.projects.length,
        recordsExtracted: imported,
        errors: 0,
        startedAt,
        completedAt: /* @__PURE__ */ new Date()
      });
      return { imported, runId };
    })
  }),
  // ─── Trend Tags ───────────────────────────────────────────────────────────
  tags: router({
    list: protectedProcedure.input(z9.object({ category: z9.string().optional() }).optional()).query(async ({ input }) => {
      return listTrendTags(input?.category);
    }),
    create: adminProcedure.input(z9.object({
      name: z9.string().min(1),
      category: z9.enum([
        "material_trend",
        "design_trend",
        "market_trend",
        "buyer_preference",
        "sustainability",
        "technology",
        "pricing",
        "other"
      ]),
      description: z9.string().optional()
    })).mutation(async ({ input, ctx }) => {
      const result = await createTrendTag({ ...input, createdBy: ctx.user.id });
      return result;
    }),
    delete: adminProcedure.input(z9.object({ id: z9.number() })).mutation(async ({ input }) => {
      await deleteTrendTag(input.id);
      return { success: true };
    }),
    // ─── Entity Tagging ───────────────────────────────────────────────────
    attach: adminProcedure.input(z9.object({
      tagId: z9.number(),
      entityType: z9.enum(["competitor_project", "scenario", "evidence_record", "project"]),
      entityId: z9.number()
    })).mutation(async ({ input, ctx }) => {
      const result = await createEntityTag({ ...input, addedBy: ctx.user.id });
      return result;
    }),
    detach: adminProcedure.input(z9.object({ id: z9.number() })).mutation(async ({ input }) => {
      await deleteEntityTag(input.id);
      return { success: true };
    }),
    getEntityTags: protectedProcedure.input(z9.object({
      entityType: z9.enum(["competitor_project", "scenario", "evidence_record", "project"]),
      entityId: z9.number()
    })).query(async ({ input }) => {
      return getEntityTags(input.entityType, input.entityId);
    }),
    getTaggedEntities: protectedProcedure.input(z9.object({ tagId: z9.number() })).query(async ({ input }) => {
      return getTaggedEntities(input.tagId);
    })
  }),
  // ─── Intelligence Audit Log ───────────────────────────────────────────────
  auditLog: router({
    list: adminProcedure.input(z9.object({
      runType: z9.string().optional(),
      limit: z9.number().default(50)
    }).optional()).query(async ({ input }) => {
      return listIntelligenceAuditLog(input?.runType, input?.limit ?? 50);
    }),
    get: adminProcedure.input(z9.object({ id: z9.number() })).query(async ({ input }) => {
      return getIntelligenceAuditEntryById(input.id);
    })
  }),
  dataHealth: protectedProcedure.query(async () => {
    return await getDataHealthStats();
  })
});
function getDefaultSources() {
  return [
    {
      name: "RAK Ceramics UAE",
      url: "https://www.rakceramics.com",
      sourceType: "manufacturer_catalog",
      reliabilityDefault: "A",
      isWhitelisted: true,
      region: "UAE",
      notes: "Major UAE ceramic tile manufacturer \u2014 product catalogs with pricing"
    },
    {
      name: "DERA Interiors",
      url: "https://www.derainteriors.com",
      sourceType: "supplier_catalog",
      reliabilityDefault: "B",
      isWhitelisted: true,
      region: "UAE",
      notes: "UAE-based interior fit-out supplier"
    },
    {
      name: "Dragon Mart Dubai",
      url: "https://www.dragonmart.ae",
      sourceType: "retailer_listing",
      reliabilityDefault: "B",
      isWhitelisted: true,
      region: "UAE",
      notes: "Large trading hub \u2014 wide range of building materials"
    },
    {
      name: "Porcelanosa UAE",
      url: "https://www.porcelanosa.com/ae",
      sourceType: "manufacturer_catalog",
      reliabilityDefault: "A",
      isWhitelisted: true,
      region: "UAE",
      notes: "Premium tile and bathroom manufacturer"
    },
    {
      name: "Emaar Properties",
      url: "https://www.emaar.com",
      sourceType: "developer_brochure",
      reliabilityDefault: "A",
      isWhitelisted: true,
      region: "UAE",
      notes: "Major UAE developer \u2014 project brochures and specifications"
    },
    {
      name: "DAMAC Properties",
      url: "https://www.damacproperties.com",
      sourceType: "developer_brochure",
      reliabilityDefault: "A",
      isWhitelisted: true,
      region: "UAE",
      notes: "Luxury developer \u2014 interior specifications and pricing signals"
    },
    {
      name: "Nakheel Properties",
      url: "https://www.nakheel.com",
      sourceType: "developer_brochure",
      reliabilityDefault: "A",
      isWhitelisted: true,
      region: "UAE",
      notes: "Major Dubai developer \u2014 community and project data"
    },
    {
      name: "RICS Market Reports",
      url: "https://www.rics.org",
      sourceType: "industry_report",
      reliabilityDefault: "A",
      isWhitelisted: true,
      region: "UAE",
      notes: "Royal Institution of Chartered Surveyors \u2014 construction cost data"
    },
    {
      name: "JLL MENA Research",
      url: "https://www.jll.com/mena",
      sourceType: "industry_report",
      reliabilityDefault: "A",
      isWhitelisted: true,
      region: "UAE",
      notes: "Real estate consultancy \u2014 market reports and cost indices"
    },
    {
      name: "Dubai Statistics Center",
      url: "https://www.dsc.gov.ae",
      sourceType: "government_tender",
      reliabilityDefault: "A",
      isWhitelisted: true,
      region: "UAE",
      notes: "Government statistics \u2014 construction indices and economic data"
    },
    {
      name: "Hafele UAE",
      url: "https://www.hafele.ae",
      sourceType: "manufacturer_catalog",
      reliabilityDefault: "A",
      isWhitelisted: true,
      region: "UAE",
      notes: "Hardware and fittings manufacturer \u2014 product catalogs"
    },
    {
      name: "GEMS Building Materials",
      url: "https://www.gemsbm.com",
      sourceType: "supplier_catalog",
      reliabilityDefault: "B",
      isWhitelisted: true,
      region: "UAE",
      notes: "Building materials supplier \u2014 pricing and availability"
    }
  ];
}

// server/routers/ingestion.ts
import { z as z10 } from "zod";

// server/engines/ingestion/connectors/index.ts
init_llm();
var SOURCE_URLS = {
  "rak-ceramics-uae": "https://www.rakceramics.com/",
  "dera-interiors": "https://derainteriors.ae/",
  "dragon-mart-dubai": "https://www.dragonmart.ae/",
  "porcelanosa-uae": "https://www.porcelanosa.com/ae/",
  "emaar-properties": "https://www.emaar.com/en/",
  "damac-properties": "https://www.damacproperties.com/en/",
  "nakheel-properties": "https://www.nakheel.com/en/",
  "rics-market-reports": "https://www.rics.org/news-insights/research-and-insights/",
  "jll-mena-research": "https://www.jll.com/en/trends-and-insights/research",
  "dubai-statistics-center": "https://www.dsc.gov.ae/en-us/Themes/Pages/default.aspx",
  "hafele-uae": "https://www.hafele.com/",
  "gems-building-materials": "https://gemsbuilding.com/products/"
};
var LLM_EXTRACTION_SYSTEM_PROMPT2 = `You are a data extraction engine for the MIYAR real estate intelligence platform.
You extract structured evidence from raw HTML content of UAE construction/real estate websites.
Return ONLY valid JSON. Do not include markdown code fences or any other text.`;
function buildExtractionUserPrompt(sourceName, category, geography, htmlSnippet, lastFetch) {
  const dateFilter = lastFetch ? `
Focus on content published or updated after ${lastFetch.toISOString().split("T")[0]}.` : "";
  return `Extract evidence items from this ${sourceName} webpage HTML.
Category: ${category}
Geography: ${geography}${dateFilter}

Return a JSON array of objects with these exact fields:
- title: string (item/product/project name)
- rawText: string (relevant text snippet, max 500 chars)
- publishedDate: string|null (ISO date if found, null otherwise)
- metric: string (what is being measured, e.g. "Marble Tile 60x60 price")
- value: number|null (numeric value in AED if found, null otherwise)
- unit: string|null (e.g. "sqm", "sqft", "piece", "unit", null if not applicable)

Rules:
- Extract up to 15 items maximum
- Only extract items with real data (titles, prices, descriptions)
- Do NOT invent data \u2014 if no items found, return empty array []
- Do NOT output confidence, grade, or scoring fields

HTML content (truncated to 8000 chars):
${htmlSnippet.substring(0, 8e3)}`;
}
async function extractViaLLM(sourceName, category, geography, html, lastFetch) {
  try {
    const textContent = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "").replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (textContent.length < 50) return [];
    const response = await invokeLLM({
      messages: [
        { role: "system", content: LLM_EXTRACTION_SYSTEM_PROMPT2 },
        {
          role: "user",
          content: buildExtractionUserPrompt(
            sourceName,
            category,
            geography,
            textContent,
            lastFetch
          )
        }
      ],
      response_format: { type: "json_object" }
    });
    const content = typeof response.choices[0]?.message?.content === "string" ? response.choices[0].message.content : "";
    if (!content) return [];
    const parsed = JSON.parse(content);
    const items = Array.isArray(parsed) ? parsed : parsed.items || parsed.data || [];
    if (!Array.isArray(items)) return [];
    return items.filter((item) => item && typeof item.title === "string" && item.title.length > 0).slice(0, 15).map((item) => ({
      title: String(item.title || "").substring(0, 255),
      rawText: String(item.rawText || item.description || item.text || "").substring(0, 500),
      publishedDate: item.publishedDate || null,
      metric: String(item.metric || item.title || "").substring(0, 255),
      value: typeof item.value === "number" && isFinite(item.value) ? item.value : null,
      unit: typeof item.unit === "string" ? item.unit : null
    }));
  } catch (err) {
    console.error(`[LLM Extraction] Failed for ${sourceName}:`, err instanceof Error ? err.message : String(err));
    return [];
  }
}
var AED_PRICE_REGEX = /(?:AED|Dhs?\.?)\s*([\d,]+(?:\.\d{1,2})?)/gi;
var NUMERIC_PRICE_REGEX = /([\d,]+(?:\.\d{1,2})?)\s*(?:AED|Dhs?\.?|per\s+(?:sqm|sqft|m²|unit|piece|set|roll))/gi;
var SQFT_REGEX = /(?:per\s+)?(?:sq\.?\s*ft\.?|sqft|square\s+foot|square\s+feet)/i;
var SQM_REGEX = /(?:per\s+)?(?:sq\.?\s*m\.?|sqm|m²|square\s+met(?:er|re))/i;
function extractPricesFromText(text2) {
  const prices = [];
  const seen = /* @__PURE__ */ new Set();
  for (const regex of [AED_PRICE_REGEX, NUMERIC_PRICE_REGEX]) {
    regex.lastIndex = 0;
    let match;
    while ((match = regex.exec(text2)) !== null) {
      const val = parseFloat(match[1].replace(/,/g, ""));
      if (!isNaN(val) && val > 0 && val < 1e8 && !seen.has(val)) {
        seen.add(val);
        const context = text2.substring(
          Math.max(0, match.index - 30),
          Math.min(text2.length, match.index + match[0].length + 30)
        );
        let unit = "unit";
        if (SQM_REGEX.test(context)) unit = "sqm";
        else if (SQFT_REGEX.test(context)) unit = "sqft";
        prices.push({ value: val, unit });
      }
    }
  }
  return prices;
}
function extractSnippet(text2, maxLen = 500) {
  return text2.replace(/\s+/g, " ").trim().substring(0, maxLen);
}
var HTMLSourceConnector = class extends BaseSourceConnector {
  async extract(raw) {
    const html = raw.rawHtml || "";
    if (!html || html.length < 50) return [];
    const llmItems = await extractViaLLM(
      this.sourceName,
      this.category,
      this.geography,
      html,
      this.lastSuccessfulFetch
    );
    if (llmItems.length > 0) {
      return llmItems.map((item) => ({
        title: `${this.sourceName} - ${item.title}`,
        rawText: item.rawText || item.title,
        publishedDate: item.publishedDate ? new Date(item.publishedDate) : void 0,
        category: this.category,
        geography: this.geography,
        sourceUrl: raw.url,
        // Store LLM-extracted metric/value/unit as metadata in rawText for normalize()
        _llmMetric: item.metric,
        _llmValue: item.value,
        _llmUnit: item.unit
      }));
    }
    return this.extractRuleBased(raw);
  }
  /** Rule-based fallback extraction — subclasses can override */
  extractRuleBased(raw) {
    const html = raw.rawHtml || "";
    const evidence = [];
    const sections = html.match(
      /<(?:div|article|section|li)[^>]*class="[^"]*(?:product|item|card|project|property|report|service)[^"]*"[^>]*>[\s\S]*?<\/(?:div|article|section|li)>/gi
    ) || [];
    for (const section of sections.slice(0, 15)) {
      const titleMatch = section.match(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/i);
      const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, "").trim() : "";
      if (!title) continue;
      const text2 = section.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      evidence.push({
        title: `${this.sourceName} - ${title}`,
        rawText: text2,
        publishedDate: void 0,
        category: this.category,
        geography: this.geography,
        sourceUrl: raw.url
      });
    }
    if (evidence.length === 0 && html.length > 100) {
      const plainText = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "").replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ");
      evidence.push({
        title: `${this.sourceName} - Page Content`,
        rawText: extractSnippet(plainText),
        publishedDate: void 0,
        category: this.category,
        geography: this.geography,
        sourceUrl: raw.url
      });
    }
    return evidence;
  }
  async normalize(evidence) {
    const grade2 = assignGrade(this.sourceId);
    const confidence = computeConfidence2(grade2, evidence.publishedDate, /* @__PURE__ */ new Date());
    const llmEvidence = evidence;
    if (llmEvidence._llmValue !== void 0) {
      return {
        metric: llmEvidence._llmMetric || evidence.title,
        value: llmEvidence._llmValue,
        unit: llmEvidence._llmUnit || this.defaultUnit,
        confidence,
        grade: grade2,
        summary: extractSnippet(evidence.rawText),
        tags: this.defaultTags
      };
    }
    const prices = extractPricesFromText(evidence.rawText);
    return {
      metric: evidence.title,
      value: prices.length > 0 ? prices[0].value : null,
      unit: prices.length > 0 ? prices[0].unit : this.defaultUnit,
      confidence,
      grade: grade2,
      summary: extractSnippet(evidence.rawText),
      tags: this.defaultTags
    };
  }
};
var RAKCeramicsConnector = class extends HTMLSourceConnector {
  sourceId = "rak-ceramics-uae";
  sourceName = "RAK Ceramics UAE";
  sourceUrl = SOURCE_URLS["rak-ceramics-uae"];
  category = "material_cost";
  geography = "UAE";
  defaultTags = ["ceramics", "tiles", "flooring", "manufacturer"];
  defaultUnit = "sqm";
};
var DERAInteriorsConnector = class extends HTMLSourceConnector {
  sourceId = "dera-interiors";
  sourceName = "DERA Interiors";
  sourceUrl = SOURCE_URLS["dera-interiors"];
  category = "fitout_rate";
  geography = "Dubai";
  defaultTags = ["fitout", "interior-design", "contractor"];
  defaultUnit = "sqft";
};
var DragonMartConnector = class extends HTMLSourceConnector {
  sourceId = "dragon-mart-dubai";
  sourceName = "Dragon Mart Dubai";
  sourceUrl = SOURCE_URLS["dragon-mart-dubai"];
  category = "material_cost";
  geography = "Dubai";
  defaultTags = ["retailer", "building-materials", "wholesale"];
  defaultUnit = "unit";
};
var PorcelanosaConnector = class extends HTMLSourceConnector {
  sourceId = "porcelanosa-uae";
  sourceName = "Porcelanosa UAE";
  sourceUrl = SOURCE_URLS["porcelanosa-uae"];
  category = "material_cost";
  geography = "UAE";
  defaultTags = ["tiles", "surfaces", "premium", "manufacturer"];
  defaultUnit = "sqm";
};
var EmaarConnector = class extends HTMLSourceConnector {
  sourceId = "emaar-properties";
  sourceName = "Emaar Properties";
  sourceUrl = SOURCE_URLS["emaar-properties"];
  category = "competitor_project";
  geography = "Dubai";
  defaultTags = ["developer", "luxury", "dubai", "residential"];
  defaultUnit = "sqft";
};
var DAMACConnector = class extends HTMLSourceConnector {
  sourceId = "damac-properties";
  sourceName = "DAMAC Properties";
  sourceUrl = SOURCE_URLS["damac-properties"];
  category = "competitor_project";
  geography = "Dubai";
  defaultTags = ["developer", "luxury", "dubai", "branded-residences"];
  defaultUnit = "sqft";
};
var NakheelConnector = class extends HTMLSourceConnector {
  sourceId = "nakheel-properties";
  sourceName = "Nakheel Properties";
  sourceUrl = SOURCE_URLS["nakheel-properties"];
  category = "competitor_project";
  geography = "Dubai";
  defaultTags = ["developer", "master-plan", "dubai", "community"];
  defaultUnit = "sqft";
};
var RICSConnector = class extends HTMLSourceConnector {
  sourceId = "rics-market-reports";
  sourceName = "RICS Market Reports";
  sourceUrl = SOURCE_URLS["rics-market-reports"];
  category = "market_trend";
  geography = "UAE";
  defaultTags = ["market-survey", "construction", "industry-report", "rics"];
  defaultUnit = "sqm";
  async normalize(evidence) {
    const grade2 = assignGrade(this.sourceId);
    const confidence = computeConfidence2(grade2, evidence.publishedDate, /* @__PURE__ */ new Date());
    const llmEvidence = evidence;
    return {
      metric: llmEvidence._llmMetric || evidence.title,
      value: llmEvidence._llmValue ?? null,
      unit: llmEvidence._llmUnit ?? null,
      confidence,
      grade: grade2,
      summary: extractSnippet(evidence.rawText),
      tags: this.defaultTags
    };
  }
};
var JLLConnector = class extends HTMLSourceConnector {
  sourceId = "jll-mena-research";
  sourceName = "JLL MENA Research";
  sourceUrl = SOURCE_URLS["jll-mena-research"];
  category = "market_trend";
  geography = "UAE";
  defaultTags = ["market-research", "real-estate", "mena", "jll"];
  defaultUnit = "sqm";
  async normalize(evidence) {
    const grade2 = assignGrade(this.sourceId);
    const confidence = computeConfidence2(grade2, evidence.publishedDate, /* @__PURE__ */ new Date());
    const llmEvidence = evidence;
    return {
      metric: llmEvidence._llmMetric || evidence.title,
      value: llmEvidence._llmValue ?? null,
      unit: llmEvidence._llmUnit ?? null,
      confidence,
      grade: grade2,
      summary: extractSnippet(evidence.rawText),
      tags: this.defaultTags
    };
  }
};
var DubaiStatisticsConnector = class extends HTMLSourceConnector {
  sourceId = "dubai-statistics-center";
  sourceName = "Dubai Statistics Center";
  sourceUrl = SOURCE_URLS["dubai-statistics-center"];
  category = "market_trend";
  geography = "Dubai";
  defaultTags = ["government", "statistics", "dubai", "economic-indicators"];
  defaultUnit = "sqm";
  async normalize(evidence) {
    const grade2 = assignGrade(this.sourceId);
    const confidence = computeConfidence2(grade2, evidence.publishedDate, /* @__PURE__ */ new Date());
    const llmEvidence = evidence;
    return {
      metric: llmEvidence._llmMetric || evidence.title,
      value: llmEvidence._llmValue ?? null,
      unit: llmEvidence._llmUnit ?? null,
      confidence,
      grade: grade2,
      summary: extractSnippet(evidence.rawText),
      tags: this.defaultTags
    };
  }
};
var HafeleConnector = class extends HTMLSourceConnector {
  sourceId = "hafele-uae";
  sourceName = "Hafele UAE";
  sourceUrl = SOURCE_URLS["hafele-uae"];
  category = "material_cost";
  geography = "UAE";
  defaultTags = ["hardware", "fittings", "joinery", "manufacturer"];
  defaultUnit = "piece";
};
var GEMSConnector = class extends HTMLSourceConnector {
  sourceId = "gems-building-materials";
  sourceName = "GEMS Building Materials";
  sourceUrl = SOURCE_URLS["gems-building-materials"];
  category = "material_cost";
  geography = "UAE";
  defaultTags = ["building-materials", "supplier", "wholesale"];
  defaultUnit = "unit";
};
var ALL_CONNECTORS = {
  "rak-ceramics-uae": () => new RAKCeramicsConnector(),
  "dera-interiors": () => new DERAInteriorsConnector(),
  "dragon-mart-dubai": () => new DragonMartConnector(),
  "porcelanosa-uae": () => new PorcelanosaConnector(),
  "emaar-properties": () => new EmaarConnector(),
  "damac-properties": () => new DAMACConnector(),
  "nakheel-properties": () => new NakheelConnector(),
  "rics-market-reports": () => new RICSConnector(),
  "jll-mena-research": () => new JLLConnector(),
  "dubai-statistics-center": () => new DubaiStatisticsConnector(),
  "hafele-uae": () => new HafeleConnector(),
  "gems-building-materials": () => new GEMSConnector()
};
function getConnectorById(sourceId) {
  const factory = ALL_CONNECTORS[sourceId];
  return factory ? factory() : null;
}
function getAllConnectors() {
  return Object.values(ALL_CONNECTORS).map((factory) => factory());
}

// server/routers/ingestion.ts
import { desc as desc3, eq as eq7 } from "drizzle-orm";

// server/engines/ingestion/scheduler.ts
import cron from "node-cron";
import { eq as eq6 } from "drizzle-orm";
var scheduledTasks = [];
var lastScheduledRunAt = null;
var isSchedulerRunning = false;
var activeSchedulesCount = 0;
function getNextScheduledRun() {
  if (scheduledTasks.length === 0) return null;
  let earliest = null;
  for (const task of scheduledTasks) {
    try {
      const nextDate = task.getNextRun();
      if (nextDate) {
        if (!earliest || nextDate < earliest) earliest = nextDate;
      }
    } catch {
    }
  }
  return earliest ? earliest.toISOString() : null;
}
function getSchedulerStatus() {
  return {
    active: scheduledTasks.length > 0,
    cronExpression: `${activeSchedulesCount} configured schedules`,
    nextScheduledRun: getNextScheduledRun(),
    lastScheduledRunAt: lastScheduledRunAt?.toISOString() ?? null,
    isCurrentlyRunning: isSchedulerRunning
  };
}

// server/routers/ingestion.ts
var ingestionRouter = router({
  /**
   * Run all 12 UAE source connectors.
   * Admin-only. Returns full IngestionRunReport.
   */
  runAll: adminProcedure.mutation(async ({ ctx }) => {
    const connectors = getAllConnectors();
    const report = await runIngestion(connectors, "manual", ctx.user.id);
    return report;
  }),
  /**
   * Run a single connector by sourceId.
   * Admin-only. Returns IngestionRunReport for that one source.
   */
  runSource: adminProcedure.input(z10.object({
    sourceId: z10.string().min(1)
  })).mutation(async ({ input, ctx }) => {
    const connector = getConnectorById(input.sourceId);
    if (!connector) {
      throw new Error(`Unknown source connector: ${input.sourceId}. Available: ${Object.keys(ALL_CONNECTORS).join(", ")}`);
    }
    const report = await runSingleConnector(connector, "manual", ctx.user.id);
    return report;
  }),
  /**
   * List past ingestion runs (paginated, newest first).
   */
  getHistory: protectedProcedure.input(z10.object({
    limit: z10.number().min(1).max(100).default(20),
    offset: z10.number().min(0).default(0)
  }).optional()).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return { runs: [], total: 0 };
    const limit = input?.limit ?? 20;
    const offset = input?.offset ?? 0;
    const runs = await db.select().from(ingestionRuns).orderBy(desc3(ingestionRuns.createdAt)).limit(limit).offset(offset);
    const allRuns = await db.select({ id: ingestionRuns.id }).from(ingestionRuns);
    const total = allRuns.length;
    return { runs, total };
  }),
  /**
   * Get current ingestion status: last run info + next scheduled run time.
   */
  getStatus: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) {
      return {
        lastRun: null,
        totalRuns: 0,
        totalRecordsIngested: 0,
        availableSources: Object.keys(ALL_CONNECTORS).length,
        scheduledCron: null,
        nextScheduledRun: null
      };
    }
    const lastRuns = await db.select().from(ingestionRuns).orderBy(desc3(ingestionRuns.createdAt)).limit(1);
    const lastRun = lastRuns.length > 0 ? lastRuns[0] : null;
    const allRuns = await db.select().from(ingestionRuns);
    const totalRuns = allRuns.length;
    const totalRecordsIngested = allRuns.reduce(
      (sum, r) => sum + (r.recordsInserted ?? 0),
      0
    );
    const scheduler = getSchedulerStatus();
    return {
      lastRun: lastRun ? {
        runId: lastRun.runId,
        status: lastRun.status,
        trigger: lastRun.trigger,
        totalSources: lastRun.totalSources,
        sourcesSucceeded: lastRun.sourcesSucceeded,
        sourcesFailed: lastRun.sourcesFailed,
        recordsInserted: lastRun.recordsInserted,
        duplicatesSkipped: lastRun.duplicatesSkipped,
        startedAt: lastRun.startedAt,
        completedAt: lastRun.completedAt,
        durationMs: lastRun.durationMs
      } : null,
      totalRuns,
      totalRecordsIngested,
      availableSources: Object.keys(ALL_CONNECTORS).length,
      scheduler
    };
  }),
  /**
   * Get detailed breakdown for a specific ingestion run.
   */
  getRunDetail: protectedProcedure.input(z10.object({ runId: z10.string() })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return null;
    const runs = await db.select().from(ingestionRuns).where(eq7(ingestionRuns.runId, input.runId)).limit(1);
    return runs.length > 0 ? runs[0] : null;
  }),
  /**
   * List all available source connector IDs with metadata.
   */
  getAvailableSources: protectedProcedure.query(() => {
    const connectors = getAllConnectors();
    return connectors.map((c) => ({
      sourceId: c.sourceId,
      sourceName: c.sourceName,
      sourceUrl: c.sourceUrl
    }));
  }),
  // ─── V3-02: Connector Health Endpoints ─────────────────────────
  /**
   * Get connector health records for a specific ingestion run.
   */
  getRunHealth: protectedProcedure.input(z10.object({ runId: z10.string() })).query(async ({ input }) => {
    return getConnectorHealthByRun(input.runId);
  }),
  /**
   * Get health history for a specific connector (last 30 records).
   */
  getSourceHealth: protectedProcedure.input(z10.object({
    sourceId: z10.string(),
    limit: z10.number().min(1).max(100).default(30)
  })).query(async ({ input }) => {
    return getConnectorHealthHistory(input.sourceId, input.limit);
  }),
  /**
   * Get health summary across all connectors (last 30 days).
   * Returns aggregated success rates and response times.
   */
  getHealthSummary: protectedProcedure.query(async () => {
    const records = await getConnectorHealthSummary();
    const bySource = /* @__PURE__ */ new Map();
    for (const r of records) {
      const existing = bySource.get(r.sourceId) || {
        sourceId: r.sourceId,
        sourceName: r.sourceName,
        totalRuns: 0,
        successes: 0,
        partials: 0,
        failures: 0,
        avgResponseMs: null,
        totalExtracted: 0,
        totalInserted: 0,
        lastStatus: r.status,
        lastRunAt: r.createdAt,
        lastError: null
      };
      existing.totalRuns++;
      if (r.status === "success") existing.successes++;
      else if (r.status === "partial") existing.partials++;
      else existing.failures++;
      existing.totalExtracted += r.recordsExtracted;
      existing.totalInserted += r.recordsInserted;
      if (r.responseTimeMs) {
        existing.avgResponseMs = existing.avgResponseMs ? Math.round((existing.avgResponseMs + r.responseTimeMs) / 2) : r.responseTimeMs;
      }
      if (!existing.lastRunAt || r.createdAt > existing.lastRunAt) {
        existing.lastStatus = r.status;
        existing.lastRunAt = r.createdAt;
        existing.lastError = r.errorMessage;
      }
      bySource.set(r.sourceId, existing);
    }
    return Array.from(bySource.values()).map((s) => ({
      ...s,
      successRate: s.totalRuns > 0 ? Math.round((s.successes + s.partials) / s.totalRuns * 100) : 0
    }));
  })
});

// server/routers/analytics.ts
import { z as z11 } from "zod";

// server/engines/analytics/market-positioning.ts
var TIER_LABELS = {
  budget: "Budget",
  mid_range: "Mid-Range",
  premium: "Premium",
  ultra_premium: "Ultra-Premium"
};
var CONFIDENCE_HIGH_MIN_POINTS2 = 15;
var CONFIDENCE_HIGH_MIN_GRADE_A2 = 2;
var CONFIDENCE_MEDIUM_MIN_POINTS2 = 8;
var CONFIDENCE_LOW_MIN_POINTS2 = 5;
function computePercentiles(values) {
  if (values.length === 0) {
    return { p25: 0, p50: 0, p75: 0, p90: 0, min: 0, max: 0, mean: 0, count: 0 };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const percentile = (p) => {
    if (n === 1) return sorted[0];
    const rank = p / 100 * (n - 1);
    const lower = Math.floor(rank);
    const upper = Math.ceil(rank);
    const fraction = rank - lower;
    if (lower === upper) return sorted[lower];
    return sorted[lower] + fraction * (sorted[upper] - sorted[lower]);
  };
  const mean = sorted.reduce((sum, v) => sum + v, 0) / n;
  return {
    p25: Math.round(percentile(25) * 100) / 100,
    p50: Math.round(percentile(50) * 100) / 100,
    p75: Math.round(percentile(75) * 100) / 100,
    p90: Math.round(percentile(90) * 100) / 100,
    min: sorted[0],
    max: sorted[n - 1],
    mean: Math.round(mean * 100) / 100,
    count: n
  };
}
function assignTier(targetValue, percentiles) {
  if (targetValue < percentiles.p25) return "budget";
  if (targetValue < percentiles.p50) return "mid_range";
  if (targetValue < percentiles.p75) return "premium";
  return "ultra_premium";
}
function computePercentileRank(targetValue, values) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const below = sorted.filter((v) => v < targetValue).length;
  const equal = sorted.filter((v) => v === targetValue).length;
  const rank = (below + 0.5 * equal) / sorted.length * 100;
  return Math.round(Math.min(100, Math.max(0, rank)) * 100) / 100;
}
function assessConfidence2(dataPointCount, gradeACount) {
  if (dataPointCount >= CONFIDENCE_HIGH_MIN_POINTS2 && gradeACount >= CONFIDENCE_HIGH_MIN_GRADE_A2) {
    return "high";
  }
  if (dataPointCount >= CONFIDENCE_MEDIUM_MIN_POINTS2) {
    return "medium";
  }
  if (dataPointCount >= CONFIDENCE_LOW_MIN_POINTS2) {
    return "low";
  }
  return "insufficient";
}
function computeCompetitiveIndex(targetValue, percentiles) {
  if (percentiles.max === percentiles.min) return 50;
  const normalized = (targetValue - percentiles.min) / (percentiles.max - percentiles.min);
  return Math.round(Math.min(100, Math.max(0, normalized * 100)) * 100) / 100;
}
function computeMarketPosition(targetValue, dataPoints) {
  const values = dataPoints.map((d) => d.value);
  const percentiles = computePercentiles(values);
  const tier = assignTier(targetValue, percentiles);
  const percentile = computePercentileRank(targetValue, values);
  const gradeACount = dataPoints.filter((d) => d.grade === "A").length;
  const uniqueSources = new Set(dataPoints.map((d) => d.sourceId)).size;
  const confidence = assessConfidence2(dataPoints.length, gradeACount);
  const competitiveIndex = computeCompetitiveIndex(targetValue, percentiles);
  return {
    targetValue,
    tier,
    tierLabel: TIER_LABELS[tier],
    percentile,
    percentiles,
    dataPointCount: dataPoints.length,
    gradeACount,
    uniqueSources,
    confidence,
    competitiveIndex,
    priceGap: {
      toP25: Math.round((targetValue - percentiles.p25) * 100) / 100,
      toP50: Math.round((targetValue - percentiles.p50) * 100) / 100,
      toP75: Math.round((targetValue - percentiles.p75) * 100) / 100,
      toP90: Math.round((targetValue - percentiles.p90) * 100) / 100
    }
  };
}

// server/engines/analytics/competitor-intelligence.ts
init_llm();
var HHI_FRAGMENTED_THRESHOLD = 0.15;
var HHI_CONCENTRATED_THRESHOLD = 0.25;
var CONCENTRATION_LABELS = {
  fragmented: "Fragmented Market",
  moderate: "Moderately Concentrated",
  concentrated: "Highly Concentrated"
};
var THREAT_HIGH_SHARE = 0.15;
var THREAT_MEDIUM_SHARE = 0.08;
var CONFIDENCE_HIGH_MIN_PROJECTS = 15;
var CONFIDENCE_HIGH_MIN_DEVELOPERS = 5;
var CONFIDENCE_MEDIUM_MIN_PROJECTS = 8;
var CONFIDENCE_LOW_MIN_PROJECTS = 3;
function computeHHI(marketShares) {
  if (marketShares.length === 0) return 0;
  const hhi = marketShares.reduce((sum, share) => sum + share * share, 0);
  return Math.round(hhi * 1e4) / 1e4;
}
function classifyConcentration(hhi) {
  if (hhi < HHI_FRAGMENTED_THRESHOLD) return "fragmented";
  if (hhi <= HHI_CONCENTRATED_THRESHOLD) return "moderate";
  return "concentrated";
}
function computeDeveloperShares(projects2) {
  const totalUnits = projects2.reduce((sum, p) => sum + p.totalUnits, 0);
  const totalProjects = projects2.length;
  const devMap = /* @__PURE__ */ new Map();
  for (const p of projects2) {
    const key = p.developerId;
    if (!devMap.has(key)) devMap.set(key, []);
    devMap.get(key).push(p);
  }
  const developers = [];
  for (const [devId, devProjects] of Array.from(devMap.entries())) {
    const devUnits = devProjects.reduce((sum, p) => sum + p.totalUnits, 0);
    const unitShare = totalUnits > 0 ? devUnits / totalUnits : 0;
    const projectShare = totalProjects > 0 ? devProjects.length / totalProjects : 0;
    const prices = devProjects.filter((p) => p.pricePerSqft !== void 0 && p.pricePerSqft > 0).map((p) => p.pricePerSqft);
    const avgPrice = prices.length > 0 ? Math.round(prices.reduce((s, v) => s + v, 0) / prices.length * 100) / 100 : null;
    const priceRange = prices.length > 0 ? { min: Math.min(...prices), max: Math.max(...prices) } : null;
    let threatLevel = "low";
    if (unitShare >= THREAT_HIGH_SHARE) threatLevel = "high";
    else if (unitShare >= THREAT_MEDIUM_SHARE) threatLevel = "medium";
    developers.push({
      developerId: devId,
      developerName: devProjects[0].developerName,
      projectCount: devProjects.length,
      totalUnits: devUnits,
      marketShareByUnits: Math.round(unitShare * 1e4) / 1e4,
      marketShareByProjects: Math.round(projectShare * 1e4) / 1e4,
      avgPricePerSqft: avgPrice,
      priceRange,
      threatLevel
    });
  }
  developers.sort((a, b) => b.marketShareByUnits - a.marketShareByUnits);
  return developers;
}
function assessConfidence3(totalProjects, totalDevelopers) {
  if (totalProjects >= CONFIDENCE_HIGH_MIN_PROJECTS && totalDevelopers >= CONFIDENCE_HIGH_MIN_DEVELOPERS) {
    return "high";
  }
  if (totalProjects >= CONFIDENCE_MEDIUM_MIN_PROJECTS) {
    return "medium";
  }
  if (totalProjects >= CONFIDENCE_LOW_MIN_PROJECTS) {
    return "low";
  }
  return "insufficient";
}
function computePriceDistribution(projects2) {
  const prices = projects2.filter((p) => p.pricePerSqft !== void 0 && p.pricePerSqft > 0).map((p) => p.pricePerSqft).sort((a, b) => a - b);
  if (prices.length === 0) return null;
  const mean = prices.reduce((s, v) => s + v, 0) / prices.length;
  const mid = Math.floor(prices.length / 2);
  const median = prices.length % 2 === 0 ? (prices[mid - 1] + prices[mid]) / 2 : prices[mid];
  return {
    min: Math.round(prices[0] * 100) / 100,
    max: Math.round(prices[prices.length - 1] * 100) / 100,
    mean: Math.round(mean * 100) / 100,
    median: Math.round(median * 100) / 100
  };
}
async function generateNarrative(result) {
  if (result.totalProjects < 3) return null;
  const topDevNames = result.topDevelopers.map((d) => d.developerName).join(", ");
  const prompt = `You are a UAE real estate market analyst. Generate a 3-sentence competitive landscape summary.

Data:
- Total projects: ${result.totalProjects}
- Total developers: ${result.totalDevelopers}
- Total units: ${result.totalUnits}
- HHI: ${result.hhi} (${result.concentrationLabel})
- Top developers: ${topDevNames}
- Top developer market shares: ${result.topDevelopers.map((d) => `${d.developerName}: ${(d.marketShareByUnits * 100).toFixed(1)}%`).join(", ")}
${result.priceDistribution ? `- Price range: AED ${result.priceDistribution.min} - ${result.priceDistribution.max}/sqft (median: AED ${result.priceDistribution.median}/sqft)` : ""}

Rules:
1. First sentence: overall market concentration assessment
2. Second sentence: identify the dominant players and their positioning
3. Third sentence: strategic implication for new market entrants
4. Use specific numbers from the data
5. Maximum 3 sentences total`;
  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: "You are a concise UAE real estate market analyst. Output exactly 3 sentences." },
        { role: "user", content: prompt }
      ]
    });
    const content = response.choices?.[0]?.message?.content;
    return typeof content === "string" ? content.trim() : null;
  } catch {
    return null;
  }
}
async function analyseCompetitorLandscape(projects2, options = {}) {
  const { generateNarrative: shouldNarrate = true } = options;
  const developers = computeDeveloperShares(projects2);
  const marketShares = developers.map((d) => d.marketShareByUnits);
  const hhi = computeHHI(marketShares);
  const concentration = classifyConcentration(hhi);
  const totalUnits = projects2.reduce((sum, p) => sum + p.totalUnits, 0);
  const priceDistribution = computePriceDistribution(projects2);
  const confidence = assessConfidence3(projects2.length, developers.length);
  const topDevelopers = developers.slice(0, 5);
  const baseResult = {
    totalProjects: projects2.length,
    totalUnits,
    totalDevelopers: developers.length,
    hhi,
    concentration,
    concentrationLabel: CONCENTRATION_LABELS[concentration],
    developers,
    topDevelopers,
    priceDistribution,
    confidence
  };
  let narrative = null;
  if (shouldNarrate && projects2.length >= 3) {
    narrative = await generateNarrative(baseResult);
  }
  return { ...baseResult, narrative };
}

// server/routers/analytics.ts
import { and as and4, eq as eq8, isNotNull } from "drizzle-orm";
var analyticsRouter = router({
  getTrends: protectedProcedure.input(
    z11.object({
      category: z11.string().optional(),
      geography: z11.string().optional(),
      direction: z11.enum(["rising", "falling", "stable", "insufficient_data"]).optional(),
      confidence: z11.enum(["high", "medium", "low", "insufficient"]).optional(),
      limit: z11.number().int().min(1).max(100).default(50)
    }).optional()
  ).query(async ({ input }) => {
    const snapshots = await getTrendSnapshots({
      category: input?.category,
      geography: input?.geography,
      direction: input?.direction,
      confidence: input?.confidence,
      limit: input?.limit
    });
    return { trends: snapshots };
  }),
  getTrendHistory: protectedProcedure.input(
    z11.object({
      metric: z11.string().min(1),
      geography: z11.string().min(1),
      limit: z11.number().int().min(1).max(100).default(20)
    })
  ).query(async ({ input }) => {
    const history = await getTrendHistory(input.metric, input.geography, input.limit);
    return { history };
  }),
  getAnomalies: protectedProcedure.input(
    z11.object({
      limit: z11.number().int().min(1).max(100).default(50)
    }).optional()
  ).query(async ({ input }) => {
    const anomalies = await getAnomalies(input?.limit);
    return { anomalies };
  }),
  getMarketPosition: protectedProcedure.input(
    z11.object({
      targetValue: z11.number().positive(),
      category: z11.string().default("floors"),
      geography: z11.string().default("UAE")
    })
  ).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    const records = await db.select().from(evidenceRecords).where(
      and4(
        eq8(evidenceRecords.category, input.category),
        isNotNull(evidenceRecords.priceMin)
      )
    );
    const dataPoints = [];
    for (const record of records) {
      const value = record.priceMin ? parseFloat(String(record.priceMin)) : null;
      if (value === null || isNaN(value) || value <= 0) continue;
      dataPoints.push({
        value,
        grade: record.reliabilityGrade || "C",
        sourceId: record.sourceRegistryId ? String(record.sourceRegistryId) : "unknown",
        date: new Date(record.captureDate || record.createdAt),
        recordId: record.id
      });
    }
    const position = computeMarketPosition(input.targetValue, dataPoints);
    return { position };
  }),
  getCompetitorLandscape: protectedProcedure.input(
    z11.object({
      geography: z11.string().default("UAE"),
      generateNarrative: z11.boolean().default(true)
    }).optional()
  ).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    const dbProjects = await db.select({
      id: competitorProjects.id,
      competitorId: competitorProjects.competitorId,
      projectName: competitorProjects.projectName,
      location: competitorProjects.location,
      totalUnits: competitorProjects.totalUnits,
      priceIndicators: competitorProjects.priceIndicators,
      launchDate: competitorProjects.launchDate,
      sourceUrl: competitorProjects.sourceUrl,
      completenessScore: competitorProjects.completenessScore,
      entityName: competitorEntities.name
    }).from(competitorProjects).leftJoin(competitorEntities, eq8(competitorProjects.competitorId, competitorEntities.id));
    const projects2 = dbProjects.map((p) => {
      let pricePerSqft;
      if (p.priceIndicators && typeof p.priceIndicators === "object") {
        const pi = p.priceIndicators;
        if (pi.per_unit) pricePerSqft = parseFloat(String(pi.per_unit));
        else if (pi.min && pi.max) pricePerSqft = (parseFloat(String(pi.min)) + parseFloat(String(pi.max))) / 2;
      }
      return {
        developerId: String(p.competitorId),
        developerName: p.entityName || "Unknown",
        projectName: p.projectName,
        totalUnits: p.totalUnits || 0,
        pricePerSqft,
        completionDate: p.launchDate ? new Date(p.launchDate) : void 0,
        location: p.location || void 0,
        grade: p.completenessScore && p.completenessScore >= 80 ? "A" : p.completenessScore && p.completenessScore >= 50 ? "B" : "C",
        sourceId: p.sourceUrl || "unknown"
      };
    });
    const landscape = await analyseCompetitorLandscape(projects2, {
      generateNarrative: input?.generateNarrative ?? true
    });
    return { landscape };
  }),
  runTrendDetection: protectedProcedure.input(
    z11.object({
      category: z11.string().min(1),
      geography: z11.string().min(1),
      windowDays: z11.number().int().min(7).max(365).default(30),
      generateNarrative: z11.boolean().default(true)
    })
  ).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    const records = await db.select().from(evidenceRecords).where(
      and4(
        eq8(evidenceRecords.category, input.category),
        isNotNull(evidenceRecords.priceMin)
      )
    );
    const metricGroups = /* @__PURE__ */ new Map();
    for (const record of records) {
      const metric = record.itemName || "unknown";
      const value = record.priceMin ? parseFloat(String(record.priceMin)) : null;
      if (value === null || isNaN(value)) continue;
      const date = record.captureDate || record.createdAt;
      if (!date) continue;
      const grade2 = record.reliabilityGrade || "C";
      const sourceId = record.sourceRegistryId ? String(record.sourceRegistryId) : "unknown";
      if (!metricGroups.has(metric)) {
        metricGroups.set(metric, []);
      }
      metricGroups.get(metric).push({
        date: new Date(date),
        value,
        grade: grade2,
        sourceId,
        recordId: record.id
      });
    }
    const results = [];
    for (const [metric, points] of Array.from(metricGroups.entries())) {
      if (points.length < 2) continue;
      const trend = await detectTrends(metric, input.category, input.geography, points, {
        windowDays: input.windowDays,
        generateNarrative: input.generateNarrative
      });
      await insertTrendSnapshot({
        metric: trend.metric,
        category: trend.category,
        geography: trend.geography,
        dataPointCount: trend.dataPointCount,
        gradeACount: trend.gradeACount,
        gradeBCount: trend.gradeBCount,
        gradeCCount: trend.gradeCCount,
        uniqueSources: trend.uniqueSources,
        dateRangeStart: trend.dateRange?.start || null,
        dateRangeEnd: trend.dateRange?.end || null,
        currentMA: trend.currentMA !== null ? String(trend.currentMA) : null,
        previousMA: trend.previousMA !== null ? String(trend.previousMA) : null,
        percentChange: trend.percentChange !== null ? String(trend.percentChange) : null,
        direction: trend.direction,
        anomalyCount: trend.anomalies.length,
        anomalyDetails: trend.anomalies.length > 0 ? trend.anomalies : null,
        confidence: trend.confidence,
        narrative: trend.narrative,
        movingAverages: trend.movingAverages.length > 0 ? trend.movingAverages : null
      });
      results.push(trend);
    }
    return {
      metricsAnalyzed: results.length,
      trends: results
    };
  }),
  getProjectInsights: protectedProcedure.input(
    z11.object({
      projectId: z11.number().optional(),
      insightType: z11.string().optional(),
      severity: z11.string().optional(),
      status: z11.string().optional(),
      limit: z11.number().min(1).max(100).default(50)
    }).optional()
  ).query(async ({ input }) => {
    const insights = await getProjectInsights({
      projectId: input?.projectId,
      insightType: input?.insightType,
      severity: input?.severity,
      status: input?.status,
      limit: input?.limit
    });
    return { insights };
  }),
  generateProjectInsights: protectedProcedure.input(
    z11.object({
      projectId: z11.number().optional(),
      enrichWithLLM: z11.boolean().default(true)
    })
  ).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    const trendSnaps = await getTrendSnapshots({ limit: 50 });
    const trends = trendSnaps.map((s) => ({
      metric: s.metric,
      category: s.category,
      direction: s.direction || "stable",
      percentChange: s.percentChange ? parseFloat(String(s.percentChange)) : null,
      confidence: s.confidence || "low",
      currentMA: s.currentMA ? parseFloat(String(s.currentMA)) : null,
      previousMA: s.previousMA ? parseFloat(String(s.previousMA)) : null,
      anomalyCount: s.anomalyCount || 0
    }));
    const dbProjects = await db.select({
      id: competitorProjects.id,
      competitorId: competitorProjects.competitorId,
      projectName: competitorProjects.projectName,
      totalUnits: competitorProjects.totalUnits,
      entityName: competitorEntities.name
    }).from(competitorProjects).leftJoin(competitorEntities, eq8(competitorProjects.competitorId, competitorEntities.id));
    let competitorLandscape;
    if (dbProjects.length > 0) {
      const compProjects = dbProjects.map((p) => ({
        developerId: String(p.competitorId),
        developerName: p.entityName || "Unknown",
        projectName: p.projectName,
        totalUnits: p.totalUnits || 0,
        grade: "B",
        sourceId: "db"
      }));
      const landscape = await analyseCompetitorLandscape(compProjects, { generateNarrative: false });
      competitorLandscape = {
        totalProjects: landscape.totalProjects,
        totalDevelopers: landscape.totalDevelopers,
        hhi: landscape.hhi,
        concentration: landscape.concentration,
        topDevelopers: landscape.topDevelopers.map((d) => ({
          developerName: d.developerName,
          marketShareByUnits: d.marketShareByUnits,
          threatLevel: d.threatLevel
        }))
      };
    }
    const insightInput = {
      trends,
      competitorLandscape,
      projectContext: input.projectId ? {
        projectId: input.projectId,
        projectName: `Project #${input.projectId}`
      } : void 0
    };
    const generated = await generateInsights(insightInput, {
      enrichWithLLM: input.enrichWithLLM
    });
    for (const insight of generated) {
      await insertProjectInsight({
        projectId: input.projectId || null,
        insightType: insight.type,
        severity: insight.severity,
        title: insight.title,
        body: insight.body,
        actionableRecommendation: insight.actionableRecommendation,
        confidenceScore: String(insight.confidenceScore),
        triggerCondition: insight.triggerCondition,
        dataPoints: insight.dataPoints
      });
    }
    return {
      generated: generated.length,
      insights: generated
    };
  }),
  updateInsightStatus: protectedProcedure.input(
    z11.object({
      insightId: z11.number(),
      status: z11.enum(["active", "acknowledged", "dismissed", "resolved"])
    })
  ).mutation(async ({ ctx, input }) => {
    await updateInsightStatus(input.insightId, input.status, ctx.user?.id);
    return { success: true };
  })
});

// server/routers/predictive.ts
import { z as z12 } from "zod";
import { TRPCError as TRPCError5 } from "@trpc/server";

// server/engines/predictive/cost-range.ts
function weightedPercentile(values, percentile) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a.value - b.value);
  const totalWeight = sorted.reduce((sum, v) => sum + v.weight, 0);
  if (totalWeight === 0) return 0;
  const target = percentile / 100 * totalWeight;
  let cumWeight = 0;
  for (let i = 0; i < sorted.length; i++) {
    cumWeight += sorted[i].weight;
    if (cumWeight >= target) {
      return sorted[i].value;
    }
  }
  return sorted[sorted.length - 1].value;
}
function gradeWeight(grade2) {
  switch (grade2) {
    case "A":
      return 3;
    case "B":
      return 2;
    case "C":
      return 1;
    default:
      return 1;
  }
}
function recencyBonus(captureDate) {
  const now = Date.now();
  const capture = new Date(captureDate).getTime();
  const daysDiff = (now - capture) / (1e3 * 60 * 60 * 24);
  return daysDiff < 90 ? 1 : 0;
}
function determineConfidence(dataPointCount, gradeACount) {
  if (dataPointCount >= 15 && gradeACount >= 2) return "high";
  if (dataPointCount >= 8) return "medium";
  if (dataPointCount >= 3) return "low";
  return "insufficient";
}
function predictCostRange(evidence, trends, options = {}) {
  let filtered = evidence;
  if (options.category) {
    filtered = filtered.filter((e) => e.category === options.category);
  }
  if (options.geography) {
    filtered = filtered.filter((e) => e.geography === options.geography);
  }
  let fallbackUsed = false;
  let fallbackReason;
  if (filtered.length < 3 && options.uaeWideEvidence && options.uaeWideEvidence.length >= 3) {
    let uaeFiltered = options.uaeWideEvidence;
    if (options.category) {
      uaeFiltered = uaeFiltered.filter((e) => e.category === options.category);
    }
    if (uaeFiltered.length >= 3) {
      filtered = uaeFiltered;
      fallbackUsed = true;
      fallbackReason = `Insufficient local data (${evidence.filter((e) => options.category ? e.category === options.category : true).length} records). Using UAE-wide fallback (${uaeFiltered.length} records).`;
    }
  }
  if (filtered.length < 3) {
    return {
      p15: 0,
      p50: 0,
      p85: 0,
      p95: 0,
      unit: "AED/sqm",
      currency: "AED",
      trendAdjustment: 0,
      trendDirection: "insufficient_data",
      confidence: "insufficient",
      dataPointCount: filtered.length,
      gradeACount: filtered.filter((e) => e.reliabilityGrade === "A").length,
      fallbackUsed,
      fallbackReason: fallbackReason || "Insufficient data for prediction"
    };
  }
  const weightedValues = filtered.map((e) => ({
    value: e.priceTypical || (e.priceMin + e.priceMax) / 2,
    weight: gradeWeight(e.reliabilityGrade) + recencyBonus(e.captureDate)
  }));
  const p15 = weightedPercentile(weightedValues, 15);
  const p50 = weightedPercentile(weightedValues, 50);
  const p85 = weightedPercentile(weightedValues, 85);
  const p95 = weightedPercentile(weightedValues, 95);
  const unitCounts = {};
  for (const e of filtered) {
    unitCounts[e.unit] = (unitCounts[e.unit] || 0) + 1;
  }
  const primaryUnit = Object.entries(unitCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "AED/sqm";
  let trendAdjustment = 0;
  let trendDirection = "insufficient_data";
  if (trends.length > 0) {
    const categoryTrend = options.category ? trends.find((t2) => t2.category === options.category && t2.confidence !== "insufficient") : void 0;
    const bestTrend = categoryTrend || trends.find((t2) => t2.confidence !== "insufficient");
    if (bestTrend) {
      trendAdjustment = bestTrend.percentChange;
      trendDirection = bestTrend.direction;
    }
  }
  const gradeACount = filtered.filter((e) => e.reliabilityGrade === "A").length;
  const confidence = determineConfidence(filtered.length, gradeACount);
  const factor = 1 + trendAdjustment / 100;
  const adjustedP15 = Math.round(p15 * factor * 100) / 100;
  const adjustedP50 = Math.round(p50 * factor * 100) / 100;
  const adjustedP85 = Math.round(p85 * factor * 100) / 100;
  const adjustedP95 = Math.round(p95 * factor * 100) / 100;
  return {
    p15: Math.round(p15 * 100) / 100,
    p50: Math.round(p50 * 100) / 100,
    p85: Math.round(p85 * 100) / 100,
    p95: Math.round(p95 * 100) / 100,
    unit: primaryUnit,
    currency: "AED",
    trendAdjustment: Math.round(trendAdjustment * 100) / 100,
    trendDirection,
    confidence,
    dataPointCount: filtered.length,
    gradeACount,
    fallbackUsed,
    fallbackReason,
    adjustedP15,
    adjustedP50,
    adjustedP85,
    adjustedP95
  };
}

// server/engines/predictive/outcome-prediction.ts
function filterComparables(outcomes, targetTypology, targetTier, targetGeography) {
  let filtered = outcomes.filter(
    (o) => o.typology === targetTypology && o.tier === targetTier && (!targetGeography || o.geography === targetGeography)
  );
  if (filtered.length >= 5) return filtered;
  filtered = outcomes.filter(
    (o) => o.typology === targetTypology && o.tier === targetTier
  );
  if (filtered.length >= 5) return filtered;
  filtered = outcomes.filter(
    (o) => o.typology === targetTypology
  );
  if (filtered.length >= 3) return filtered;
  return outcomes;
}
function predictOutcome(compositeScore, outcomes, variableContributions, options = {}) {
  const typology = options.typology || "Residential";
  const tier = options.tier || "Mid";
  const comparables = filterComparables(outcomes, typology, tier, options.geography);
  const contributions = Object.entries(variableContributions).map(([variable, data]) => ({
    variable,
    contribution: data.contribution,
    dimension: data.dimension
  }));
  const keyRiskFactors = contributions.filter((c) => c.contribution < 0).sort((a, b) => a.contribution - b.contribution).slice(0, 5);
  const keySuccessFactors = contributions.filter((c) => c.contribution > 0).sort((a, b) => b.contribution - a.contribution).slice(0, 5);
  if (comparables.length === 0 && Object.keys(variableContributions).length === 0) {
    return {
      successLikelihood: 0,
      confidenceLevel: "insufficient",
      comparableCount: 0,
      validatedRate: 0,
      conditionalRate: 0,
      notValidatedRate: 0,
      keyRiskFactors,
      keySuccessFactors,
      predictionBasis: "insufficient_data"
    };
  }
  const validatedCount = comparables.filter((o) => o.decisionStatus === "validated").length;
  const conditionalCount = comparables.filter((o) => o.decisionStatus === "conditional").length;
  const notValidatedCount = comparables.filter((o) => o.decisionStatus === "not_validated").length;
  const total = comparables.length || 1;
  const validatedRate = validatedCount / total * 100;
  const conditionalRate = conditionalCount / total * 100;
  const notValidatedRate = notValidatedCount / total * 100;
  const baseLikelihood = compositeScore / 100 * 60 + 20;
  const comparableBonus = comparables.length >= 3 ? (validatedRate - 50) * 0.2 : 0;
  const successLikelihood = Math.max(5, Math.min(95, Math.round((baseLikelihood + comparableBonus) * 10) / 10));
  let confidenceLevel;
  if (comparables.length >= 10 && Object.keys(variableContributions).length >= 10) {
    confidenceLevel = "high";
  } else if (comparables.length >= 5 || Object.keys(variableContributions).length >= 5) {
    confidenceLevel = "medium";
  } else if (comparables.length >= 1 || Object.keys(variableContributions).length >= 1) {
    confidenceLevel = "low";
  } else {
    confidenceLevel = "insufficient";
  }
  const predictionBasis = comparables.length >= 3 ? `Based on ${comparables.length} comparable projects and ${Object.keys(variableContributions).length} variable contributions` : `Based primarily on composite score (${compositeScore.toFixed(1)}) with limited comparable data`;
  return {
    successLikelihood,
    confidenceLevel,
    comparableCount: comparables.length,
    validatedRate: Math.round(validatedRate * 10) / 10,
    conditionalRate: Math.round(conditionalRate * 10) / 10,
    notValidatedRate: Math.round(notValidatedRate * 10) / 10,
    keyRiskFactors,
    keySuccessFactors,
    predictionBasis
  };
}

// server/engines/predictive/scenario-projection.ts
function marketFactor(condition) {
  switch (condition) {
    case "tight":
      return 1.05;
    case "soft":
      return 0.95;
    default:
      return 1;
  }
}
function annualToMonthlyRate(annualPct) {
  const annualRate = annualPct / 100;
  return Math.pow(1 + annualRate, 1 / 12) - 1;
}
function projectScenarioCost(input) {
  const {
    baseCostPerSqm,
    gfa,
    trendPercentChange,
    trendDirection,
    marketCondition,
    horizonMonths,
    currency = "AED"
  } = input;
  const safeCost = baseCostPerSqm || 0;
  const safeGfa = gfa || 0;
  const safeTrend = trendDirection === "insufficient_data" ? 0 : trendPercentChange;
  const safeHorizon = Math.max(1, Math.min(horizonMonths || 18, 120));
  const mFactor = marketFactor(marketCondition);
  const monthlyRate = annualToMonthlyRate(safeTrend);
  const milestones = [3, 6, 12, safeHorizon].filter((v, i, arr) => arr.indexOf(v) === i).sort((a, b) => a - b);
  function computeProjections(baseCost) {
    return milestones.map((month) => {
      const compounded = baseCost * Math.pow(1 + monthlyRate, month) * mFactor;
      const totalCost = compounded * safeGfa;
      const cumulativeChange = baseCost > 0 ? (compounded - baseCost) / baseCost * 100 : 0;
      return {
        month,
        costPerSqm: Math.round(compounded * 100) / 100,
        totalCost: Math.round(totalCost * 100) / 100,
        cumulativeChange: Math.round(cumulativeChange * 100) / 100
      };
    });
  }
  const midProjections = computeProjections(safeCost);
  const lowProjections = computeProjections(safeCost * 0.9);
  const highProjections = computeProjections(safeCost * 1.15);
  return {
    baseCostPerSqm: safeCost,
    baseTotalCost: Math.round(safeCost * safeGfa * 100) / 100,
    projections: midProjections,
    lowScenario: lowProjections,
    midScenario: midProjections,
    highScenario: highProjections,
    currency,
    horizonMonths: safeHorizon,
    monthlyRate: Math.round(monthlyRate * 1e6) / 1e6,
    marketFactor: mFactor,
    annualizedTrend: safeTrend
  };
}

// server/engines/learning/pattern-extractor.ts
var SEED_PATTERNS = [
  {
    id: 1,
    // hardcoded IDs for seeds
    name: "High Complexity + Low Execution Readiness",
    description: "Projects with highly complex spatial configurations but poor execution planning correlate strongly with severe rework.",
    category: "risk_indicator",
    conditions: JSON.parse('[{"dimension": "SA", "operator": "<", "value": 40}, {"dimension": "ER", "operator": "<", "value": 40}]')
  },
  {
    id: 2,
    name: "Excellent Delivery + Premium Materials",
    description: "Projects exhibiting strong execution readiness coupled with top-tier material provenances reliably deliver high client satisfaction.",
    category: "success_driver",
    conditions: JSON.parse('[{"dimension": "ER", "operator": ">", "value": 80}, {"dimension": "MP", "operator": ">", "value": 80}]')
  },
  {
    id: 3,
    name: "Financial Friction + Poor Data Quality",
    description: "When procurement liquidity is tight and the underlying project data is poor, cost anomalies (overruns) are highly probable.",
    category: "cost_anomaly",
    conditions: JSON.parse('[{"dimension": "FF", "operator": "<", "value": 40}, {"dimension": "DS", "operator": "<", "value": 40}]')
  },
  {
    id: 4,
    name: "Rushed Delivery Risk",
    description: "Very low execution readiness paired with average complexity often masks rushed timelines, leading to missed delivery dates.",
    category: "risk_indicator",
    conditions: JSON.parse('[{"dimension": "ER", "operator": "<", "value": 30}, {"dimension": "SA", "operator": ">", "value": 40}, {"dimension": "SA", "operator": "<", "value": 70}]')
  },
  {
    id: 5,
    name: "Balanced Fundamentals Core",
    description: "Projects maintaining above-average scores across all five intelligence lenses demonstrate resilient success rates.",
    category: "success_driver",
    conditions: JSON.parse('[{"dimension": "SA", "operator": ">", "value": 60}, {"dimension": "FF", "operator": ">", "value": 60}, {"dimension": "MP", "operator": ">", "value": 60}, {"dimension": "DS", "operator": ">", "value": 60}, {"dimension": "ER", "operator": ">", "value": 60}]')
  }
];
function matchScoreMatrixToPatterns(scores, availablePatterns) {
  const matchedPatterns = [];
  for (const pattern of availablePatterns) {
    const conditions = pattern.conditions;
    let isMatch = true;
    for (const cond of conditions) {
      const actualScore = scores[cond.dimension];
      if (actualScore === void 0) {
        isMatch = false;
        break;
      }
      if (cond.operator === "<" && !(actualScore < cond.value)) isMatch = false;
      if (cond.operator === ">" && !(actualScore > cond.value)) isMatch = false;
      if (cond.operator === "<=" && !(actualScore <= cond.value)) isMatch = false;
      if (cond.operator === ">=" && !(actualScore >= cond.value)) isMatch = false;
      if (cond.operator === "==" && !(actualScore === cond.value)) isMatch = false;
    }
    if (isMatch) {
      matchedPatterns.push(pattern);
    }
  }
  return matchedPatterns;
}

// server/routers/predictive.ts
var predictiveRouter = router({
  /**
   * V4-08: Get cost range prediction for a project category
   */
  getCostRange: protectedProcedure.input(z12.object({
    projectId: z12.number(),
    category: z12.string().optional(),
    geography: z12.string().optional()
  })).query(async ({ input }) => {
    const project = await getProjectById(input.projectId);
    if (!project) throw new TRPCError5({ code: "NOT_FOUND" });
    const projectEvidence = await listEvidenceRecords({ projectId: input.projectId, limit: 500 });
    const allEvidence = await listEvidenceRecords({ limit: 1e3 });
    const toDataPoint = (e) => ({
      priceMin: Number(e.priceMin) || 0,
      priceTypical: Number(e.priceTypical) || 0,
      priceMax: Number(e.priceMax) || 0,
      unit: e.unit || "sqm",
      reliabilityGrade: e.reliabilityGrade,
      confidenceScore: e.confidenceScore,
      captureDate: e.captureDate,
      category: e.category,
      geography: project.ctx04Location || "UAE"
    });
    const evidence = projectEvidence.map(toDataPoint);
    const uaeWideEvidence = allEvidence.map(toDataPoint);
    const trends = await getTrendSnapshots({ category: input.category, limit: 10 });
    const trendData = trends.map((t2) => ({
      category: t2.category,
      direction: t2.direction,
      percentChange: Number(t2.percentChange) || 0,
      confidence: t2.confidence
    }));
    return predictCostRange(evidence, trendData, {
      category: input.category,
      geography: input.geography || project.ctx04Location || void 0,
      uaeWideEvidence
    });
  }),
  /**
   * V4-09: Get outcome prediction for a project
   */
  getOutcomePrediction: protectedProcedure.input(z12.object({ projectId: z12.number() })).query(async ({ input }) => {
    const project = await getProjectById(input.projectId);
    if (!project) throw new TRPCError5({ code: "NOT_FOUND" });
    const matrices = await getScoreMatricesByProject(input.projectId);
    const latest = matrices[0];
    if (!latest) {
      return predictOutcome(0, [], {}, {
        typology: project.ctx01Typology || "Residential",
        tier: project.mkt01Tier || "Mid"
      });
    }
    const compositeScore = Number(latest.compositeScore) || 0;
    const variableContributions = latest.variableContributions || {};
    const allScores = await getAllScoreMatrices();
    const outcomes = [];
    for (const sm of allScores) {
      if (sm.projectId === input.projectId) continue;
      const proj = await getProjectById(sm.projectId);
      if (!proj) continue;
      outcomes.push({
        projectId: sm.projectId,
        compositeScore: Number(sm.compositeScore) || 0,
        decisionStatus: sm.decisionStatus,
        typology: proj.ctx01Typology || "Residential",
        tier: proj.mkt01Tier || "Mid",
        geography: proj.ctx04Location || void 0
      });
    }
    return predictOutcome(compositeScore, outcomes, variableContributions, {
      typology: project.ctx01Typology || "Residential",
      tier: project.mkt01Tier || "Mid",
      geography: project.ctx04Location || void 0
    });
  }),
  /**
   * V5-08: Get matched learning patterns for a project
   */
  getProjectPatterns: protectedProcedure.input(z12.object({ projectId: z12.number() })).query(async ({ input }) => {
    const project = await getProjectById(input.projectId);
    if (!project) throw new TRPCError5({ code: "NOT_FOUND" });
    const matrices = await getScoreMatricesByProject(input.projectId);
    const latest = matrices[0];
    if (!latest) return [];
    const ormDb = await getDb();
    const activePatterns = await ormDb.select().from(decisionPatterns);
    const scores = {
      SA: Number(latest.saScore) || 0,
      FF: Number(latest.ffScore) || 0,
      MP: Number(latest.mpScore) || 0,
      DS: Number(latest.dsScore) || 0,
      ER: Number(latest.erScore) || 0
    };
    return matchScoreMatrixToPatterns(scores, activePatterns);
  }),
  /**
   * V4-10: Get scenario cost projection
   */
  getScenarioProjection: protectedProcedure.input(z12.object({
    projectId: z12.number(),
    horizonMonths: z12.number().default(18),
    marketCondition: z12.enum(["tight", "balanced", "soft"]).default("balanced")
  })).query(async ({ input }) => {
    const project = await getProjectById(input.projectId);
    if (!project) throw new TRPCError5({ code: "NOT_FOUND" });
    const gfa = Number(project.ctx03Gfa) || 0;
    const budgetCap = Number(project.fin01BudgetCap) || 0;
    const budgetPerSqm = gfa > 0 ? budgetCap / gfa : 0;
    const trends = await getTrendSnapshots({ limit: 10 });
    let trendPercentChange = 0;
    let trendDirection = "insufficient_data";
    if (trends.length > 0) {
      const bestTrend = trends.find((t2) => t2.confidence !== "insufficient") || trends[0];
      trendPercentChange = Number(bestTrend.percentChange) || 0;
      trendDirection = bestTrend.direction || "insufficient_data";
    }
    return projectScenarioCost({
      baseCostPerSqm: budgetPerSqm,
      gfa,
      trendPercentChange,
      trendDirection,
      marketCondition: input.marketCondition,
      horizonMonths: input.horizonMonths
    });
  }),
  /**
   * V4-13: Get UAE-wide cost ranges by market tier for analytics dashboard
   */
  getUaeCostRanges: protectedProcedure.query(async () => {
    const allEvidence = await listEvidenceRecords({ limit: 2e3 });
    const trends = await getTrendSnapshots({ limit: 50 });
    const tiers = ["Economy", "Mid", "Upper-mid", "Premium", "Luxury", "Ultra-luxury"];
    const categories = ["floors", "walls", "ceilings", "joinery", "lighting", "sanitary", "kitchen", "hardware", "ffe"];
    const results = [];
    for (const category of categories) {
      const catEvidence = allEvidence.filter((e) => e.category === category).map((e) => ({
        priceMin: Number(e.priceMin) || 0,
        priceTypical: Number(e.priceTypical) || 0,
        priceMax: Number(e.priceMax) || 0,
        unit: e.unit || "sqm",
        reliabilityGrade: e.reliabilityGrade,
        confidenceScore: e.confidenceScore,
        captureDate: e.captureDate,
        category: e.category,
        geography: "UAE"
      }));
      const catTrends = trends.filter((t2) => t2.category === category).map((t2) => ({
        category: t2.category,
        direction: t2.direction,
        percentChange: Number(t2.percentChange) || 0,
        confidence: t2.confidence
      }));
      const prediction = predictCostRange(catEvidence, catTrends, { category });
      results.push({ tier: "All", category, prediction });
    }
    return results;
  })
});

// server/routers/learning.ts
import { z as z13 } from "zod";
import { TRPCError as TRPCError6 } from "@trpc/server";
import { eq as eq9, desc as desc4 } from "drizzle-orm";

// server/engines/learning/outcome-comparator.ts
function compareOutcomeToPrediction(params) {
  const { projectId, outcome, scoreMatrix, costPrediction, outcomePrediction } = params;
  const actualCost = outcome.actualTotalCost ? Number(outcome.actualTotalCost) : null;
  const actualFitoutCost = outcome.actualFitoutCostPerSqm ? Number(outcome.actualFitoutCostPerSqm) : null;
  let predictedCostMid = null;
  let costDeltaPct = null;
  let costAccuracyBand = "no_prediction";
  if (costPrediction && actualFitoutCost) {
    predictedCostMid = costPrediction.adjustedP50 ?? costPrediction.p50;
    if (predictedCostMid && predictedCostMid > 0) {
      costDeltaPct = (actualFitoutCost - predictedCostMid) / predictedCostMid * 100;
      const absDelta = Math.abs(costDeltaPct);
      if (absDelta <= 10) {
        costAccuracyBand = "within_10pct";
      } else if (absDelta <= 20) {
        costAccuracyBand = "within_20pct";
      } else {
        costAccuracyBand = "outside_20pct";
      }
    }
  }
  const predictedComposite = Number(scoreMatrix.compositeScore);
  const predictedDecision = scoreMatrix.decisionStatus || "not_validated";
  const actualOutcomeSuccess = Boolean(
    outcome.projectDeliveredOnTime && outcome.clientSatisfactionScore && outcome.clientSatisfactionScore >= 3 && !outcome.reworkOccurred
  );
  let scorePredictionCorrect = false;
  if (predictedDecision === "validated" && actualOutcomeSuccess) scorePredictionCorrect = true;
  if (predictedDecision === "not_validated" && !actualOutcomeSuccess) scorePredictionCorrect = true;
  const predictedRisk = Number(scoreMatrix.riskScore);
  const actualReworkOccurred = Boolean(outcome.reworkOccurred);
  let riskPredictionCorrect = false;
  if (predictedRisk >= 60 && actualReworkOccurred) riskPredictionCorrect = true;
  if (predictedRisk < 60 && !actualReworkOccurred) riskPredictionCorrect = true;
  let overallAccuracyGrade = "insufficient_data";
  if (costAccuracyBand === "no_prediction" || outcome.actualTotalCost === null) {
  } else if (costAccuracyBand === "within_10pct" && scorePredictionCorrect && riskPredictionCorrect) {
    overallAccuracyGrade = "A";
  } else if ((costAccuracyBand === "within_10pct" || costAccuracyBand === "within_20pct") && (scorePredictionCorrect || riskPredictionCorrect)) {
    overallAccuracyGrade = "B";
  } else {
    overallAccuracyGrade = "C";
  }
  const learningSignals = [];
  if (costDeltaPct !== null) {
    if (costDeltaPct > 5) {
      learningSignals.push({
        signalType: "cost_under_predicted",
        magnitude: Math.abs(costDeltaPct),
        affectedDimension: null,
        suggestedAdjustmentDirection: "increase"
      });
    } else if (costDeltaPct < -5) {
      learningSignals.push({
        signalType: "cost_over_predicted",
        magnitude: Math.abs(costDeltaPct),
        affectedDimension: null,
        suggestedAdjustmentDirection: "decrease"
      });
    }
  }
  if (actualReworkOccurred && predictedRisk < 60) {
    learningSignals.push({
      signalType: "risk_under_predicted",
      magnitude: 60 - predictedRisk,
      affectedDimension: "ER",
      // Execution Readiness usually ties to rework
      suggestedAdjustmentDirection: "increase"
    });
  } else if (!actualReworkOccurred && predictedRisk >= 60) {
    learningSignals.push({
      signalType: "risk_over_predicted",
      magnitude: predictedRisk - 59,
      affectedDimension: "ER",
      suggestedAdjustmentDirection: "decrease"
    });
  }
  if (scorePredictionCorrect) {
    learningSignals.push({
      signalType: "score_correctly_predicted",
      magnitude: 1,
      affectedDimension: null,
      suggestedAdjustmentDirection: "none"
    });
  } else {
    learningSignals.push({
      signalType: "score_incorrectly_predicted",
      magnitude: 1,
      affectedDimension: null,
      suggestedAdjustmentDirection: "none"
      // precise dimension adjustment handled by weight-analyser
    });
  }
  if (overallAccuracyGrade === "insufficient_data") {
    return {
      projectId,
      comparedAt: /* @__PURE__ */ new Date(),
      predictedCostMid,
      actualCost: actualFitoutCost,
      costDeltaPct,
      costAccuracyBand,
      predictedComposite,
      predictedDecision,
      actualOutcomeSuccess,
      scorePredictionCorrect,
      predictedRisk,
      actualReworkOccurred,
      riskPredictionCorrect,
      overallAccuracyGrade,
      learningSignals: [],
      rawComparison: {
        outcomeId: outcome.id,
        costDeltaRaw: costDeltaPct
      }
    };
  }
  return {
    projectId,
    comparedAt: /* @__PURE__ */ new Date(),
    predictedCostMid,
    actualCost: actualFitoutCost,
    costDeltaPct,
    costAccuracyBand,
    predictedComposite,
    predictedDecision,
    actualOutcomeSuccess,
    scorePredictionCorrect,
    predictedRisk,
    actualReworkOccurred,
    riskPredictionCorrect,
    overallAccuracyGrade,
    learningSignals,
    rawComparison: {
      outcomeId: outcome.id,
      costDeltaRaw: costDeltaPct
    }
  };
}

// server/routers/learning.ts
var learningRouter = router({
  getAccuracyLedger: protectedProcedure.query(async () => {
    const ormDb = await getDb();
    const rows = await ormDb.select().from(accuracySnapshots).orderBy(desc4(accuracySnapshots.snapshotDate)).limit(1);
    return rows[0] || null;
  }),
  getAccuracyHistory: protectedProcedure.input(z13.object({ limit: z13.number().default(20) }).optional()).query(async ({ input }) => {
    const ormDb = await getDb();
    return await ormDb.select().from(accuracySnapshots).orderBy(desc4(accuracySnapshots.snapshotDate)).limit(input?.limit || 20);
  }),
  getPendingLogicProposals: protectedProcedure.query(async () => {
    const ormDb = await getDb();
    return await ormDb.select().from(logicChangeLog).where(eq9(logicChangeLog.status, "proposed")).orderBy(desc4(logicChangeLog.createdAt));
  }),
  getPendingBenchmarkSuggestions: protectedProcedure.query(async () => {
    const ormDb = await getDb();
    return await ormDb.select().from(benchmarkSuggestions).where(eq9(benchmarkSuggestions.status, "pending")).orderBy(desc4(benchmarkSuggestions.createdAt));
  }),
  getComparison: protectedProcedure.input(z13.object({ projectId: z13.number() })).query(async ({ input }) => {
    const ormDb = await getDb();
    const rows = await ormDb.select().from(outcomeComparisons).where(eq9(outcomeComparisons.projectId, input.projectId)).orderBy(desc4(outcomeComparisons.comparedAt)).limit(1);
    return rows[0] || null;
  }),
  runComparison: protectedProcedure.input(z13.object({ projectId: z13.number() })).mutation(async ({ input }) => {
    const ormDb = await getDb();
    const outcomes = await ormDb.select().from(projectOutcomes).where(eq9(projectOutcomes.projectId, input.projectId)).limit(1);
    if (!outcomes.length) {
      throw new TRPCError6({ code: "NOT_FOUND", message: "No outcome found for project" });
    }
    const outcome = outcomes[0];
    const matrices = await ormDb.select().from(scoreMatrices).where(eq9(scoreMatrices.projectId, input.projectId)).orderBy(desc4(scoreMatrices.computedAt)).limit(1);
    if (!matrices.length) {
      throw new TRPCError6({ code: "NOT_FOUND", message: "No score matrix found for project" });
    }
    const scoreMatrix = matrices[0];
    const project = await getProjectById(input.projectId);
    if (!project) throw new TRPCError6({ code: "NOT_FOUND", message: "Project not found" });
    const projectEvidence = await listEvidenceRecords({ projectId: input.projectId, limit: 500 });
    const allEvidence = await listEvidenceRecords({ limit: 1e3 });
    const toDataPoint = (e) => ({
      priceMin: Number(e.priceMin) || 0,
      priceTypical: Number(e.priceTypical) || 0,
      priceMax: Number(e.priceMax) || 0,
      unit: e.unit || "sqm",
      reliabilityGrade: e.reliabilityGrade,
      confidenceScore: e.confidenceScore,
      captureDate: e.captureDate,
      category: e.category,
      geography: project.ctx04Location || "UAE"
    });
    const evidence = projectEvidence.map(toDataPoint);
    const uaeWideEvidence = allEvidence.map(toDataPoint);
    const trends = await getTrendSnapshots({ limit: 10 });
    const trendData = trends.map((t2) => ({
      category: t2.category,
      direction: t2.direction,
      percentChange: Number(t2.percentChange) || 0,
      confidence: t2.confidence
    }));
    const costPrediction = predictCostRange(evidence, trendData, {
      category: void 0,
      geography: project.ctx04Location || void 0,
      uaeWideEvidence
    });
    const allScores = await getAllScoreMatrices();
    const comparableOutcomes = [];
    for (const sm of allScores) {
      if (sm.projectId === input.projectId) continue;
      const proj = await getProjectById(sm.projectId);
      if (!proj) continue;
      comparableOutcomes.push({
        projectId: sm.projectId,
        compositeScore: Number(sm.compositeScore) || 0,
        decisionStatus: sm.decisionStatus,
        typology: proj.ctx01Typology || "Residential",
        tier: proj.mkt01Tier || "Mid",
        geography: proj.ctx04Location || void 0
      });
    }
    const outcomePrediction = predictOutcome(
      Number(scoreMatrix.compositeScore) || 0,
      comparableOutcomes,
      scoreMatrix.variableContributions || {},
      {
        typology: project.ctx01Typology || "Residential",
        tier: project.mkt01Tier || "Mid",
        geography: project.ctx04Location || void 0
      }
    );
    const comparison = compareOutcomeToPrediction({
      projectId: input.projectId,
      outcome,
      scoreMatrix,
      costPrediction,
      outcomePrediction
    });
    const [insertResult] = await ormDb.insert(outcomeComparisons).values(comparison);
    return { success: true, comparisonId: Number(insertResult.insertId), comparison };
  })
});

// server/routers/autonomous.ts
import { z as z14 } from "zod";
import { eq as eq11, and as and5, desc as desc6, sql as sql6 } from "drizzle-orm";
import { TRPCError as TRPCError7 } from "@trpc/server";

// server/engines/autonomous/nl-engine.ts
init_llm();
import { sql as sql5 } from "drizzle-orm";
var SCHEMA_CONTEXT = `
You are the MIYAR Intelligence Assistant, an expert AI embedded within MIYAR (an autonomous interior design and architectural validation platform). 
Your primary capability is translating user natural language queries into valid MySQL SELECT queries to fetch data from the platform. 
However, you are also capable of answering general questions about what MIYAR is, how it works, and greeting the user naturally.

MIYAR Context:
- MIYAR is an autonomous interior design platform that validates project costs, generates architectural documents (like Design Briefs, Finish Schedules, RFQs), and analyzes market trends.
- Users create "Projects" inside MIYAR, and the platform scores them against market benchmarks to determine risk, ROI, and aesthetic direction.
- You CANNOT create or modify projects. You can only read data or answer questions.

Database Schema Context (Use exact camelCase column names as provided):
- users: id, email, role, createdAt
- projects: id, name, userId, status, ctx01Typology, ctx04Location, mkt01Tier, createdAt, updatedAt
- score_matrices: id, projectId, compositeScore, rasScore, riskScore, confidenceScore, decisionStatus, saScore, ffScore, mpScore, dsScore, erScore, createdAt
- benchmark_data: id, typology, location, marketTier, totalCostMid, areaMid, scopeFactors
- platform_alerts: id, severity (critical, high, medium, info), alertType (price_shock, project_at_risk, accuracy_degraded, pattern_warning, benchmark_drift, market_opportunity), title, message, status (active, acknowledged, resolved), affectedProjectIds (JSON), createdAt
- project_outcomes: id, projectId, metric, predictedVal, actualVal, deltaPct, accuracyScore, status

CRITICAL RULES:
1. If the user asks for DATA (e.g. "show me projects", "highest risk"), generate ONLY a valid MySQL SELECT query. Do NOT include markdown blocks.
2. ONLY use SELECT. Do NOT use INSERT, UPDATE, DELETE, DROP.
3. Be aware of the tables and EXACT column names provided (they use camelCase).
4. Limit the results to 50 rows maximum to prevent huge payloads.
5. If the user asks a conversational question (e.g. "hi"), asks what MIYAR is, or asks you to perform an action you can't do (e.g. "create a project"), DO NOT output SQL. Output a polite, confident, and intelligent conversational response starting exactly with the prefix "MESSAGE: ".
`;
async function processNlQuery(userId, query) {
  const startTime = Date.now();
  let generatedSql = "";
  let rawData = [];
  let textOutput = "";
  let status = "success";
  try {
    const sqlResponse = await invokeLLM({
      messages: [
        { role: "system", content: SCHEMA_CONTEXT },
        { role: "user", content: `User query: ${query}
Generate the MySQL query.` }
      ]
    });
    const content = sqlResponse.choices?.[0]?.message?.content;
    generatedSql = typeof content === "string" ? content : Array.isArray(content) ? content.map((c) => c.text || "").join("") : "";
    generatedSql = generatedSql.trim();
    if (generatedSql.startsWith("MESSAGE:")) {
      return {
        textOutput: generatedSql.replace("MESSAGE:", "").trim(),
        rawData: [],
        sqlGenerated: ""
      };
    }
    generatedSql = generatedSql.replace(/^```sql\n?/, "").replace(/\n?```$/, "").trim();
    if (!generatedSql.toUpperCase().startsWith("SELECT")) {
      return {
        textOutput: "I am a read-only data assistant and cannot perform actions that modify data (like creating or updating records). Please use the MIYAR platform interfaces to perform those actions, or ask me for data insights!",
        rawData: [],
        sqlGenerated: generatedSql
      };
    }
    const db = await getDb();
    if (!db) throw new Error("Database not connected");
    try {
      const result = await db.execute(sql5.raw(generatedSql));
      if (Array.isArray(result) && result.length > 0 && Array.isArray(result[0])) {
        rawData = result[0];
      } else {
        rawData = result;
      }
    } catch (dbError) {
      console.error("[NlEngine] SQL Execution Error:", dbError);
      status = "error";
      return {
        textOutput: `I experienced an error executing the generated query. I might need a more specific prompt. (Internal Error: ${dbError.message})`,
        rawData: [],
        sqlGenerated: generatedSql
      };
    }
    const interpretationContext = `
You are a helpful MIYAR data analyst assistant.
The user asked a question, we translated it to SQL, and got the following raw JSON data.
Please provide a clear, concise, and professional answer to the user based on the data.
Avoid exposing raw JSON or SQL. 
Explain the findings in simple terms.
`;
    const truncatedData = rawData.slice(0, 20);
    const answerResponse = await invokeLLM({
      messages: [
        { role: "system", content: interpretationContext },
        { role: "user", content: `User Question: ${query}

Data Returned:
${JSON.stringify(truncatedData, null, 2)}` }
      ]
    });
    const ansContent = answerResponse.choices?.[0]?.message?.content;
    textOutput = typeof ansContent === "string" ? ansContent : Array.isArray(ansContent) ? ansContent.map((c) => c.text || "").join("") : "";
    return {
      textOutput,
      rawData,
      sqlGenerated: generatedSql
    };
  } catch (error) {
    console.error("[NlEngine] Query processing failed:", error);
    status = "error";
    throw new Error(error.message || "Failed to process natural language query.");
  } finally {
    const executionMs = Date.now() - startTime;
    const db = await getDb();
    if (db && userId) {
      try {
        await db.insert(nlQueryLog).values({
          userId,
          queryText: query,
          sqlGenerated: generatedSql || void 0,
          rowsReturned: rawData.length,
          executionMs,
          status
        });
      } catch (logErr) {
        console.error("[NlEngine] Failed to log NL query:", logErr);
      }
    }
  }
}

// server/engines/autonomous/portfolio-engine.ts
init_llm();
import { eq as eq10, desc as desc5 } from "drizzle-orm";
async function generatePortfolioInsights() {
  const db = await getDb();
  if (!db) throw new Error("Database error");
  const allProjects = await db.select().from(projects).where(eq10(projects.status, "evaluated"));
  if (allProjects.length === 0) {
    return "No evaluated projects available for portfolio analysis.";
  }
  const portfolioProjects = [];
  for (const p of allProjects) {
    const scores = await db.select().from(scoreMatrices).where(eq10(scoreMatrices.projectId, p.id)).orderBy(desc5(scoreMatrices.computedAt)).limit(1);
    if (scores.length > 0) {
      const s = scores[0];
      portfolioProjects.push({
        project: p,
        scoreMatrix: s,
        intelligence: {
          costBand: p.fin01BudgetCap ? p.fin01BudgetCap + " AED/sqft" : "market_mid"
        }
      });
    }
  }
  const distributions = computeDistributions(portfolioProjects);
  const heatmap = computeComplianceHeatmap(portfolioProjects);
  const failurePatterns = detectFailurePatterns(portfolioProjects);
  const levers = computeImprovementLevers(portfolioProjects);
  const briefProjects = portfolioProjects.map((p) => ({
    name: p.project.name,
    tier: p.project.mkt01Tier || "Unknown",
    score: Number(p.scoreMatrix.compositeScore),
    status: p.project.status,
    risk: Number(p.scoreMatrix.riskScore)
  }));
  const payload = {
    summary: {
      totalProjects: briefProjects.length,
      averageScore: briefProjects.reduce((acc, curr) => acc + curr.score, 0) / briefProjects.length
    },
    distributions,
    failurePatterns,
    topLevers: levers.slice(0, 5)
  };
  const sysPrompt = [
    "You are the MIYAR Portfolio Intelligence Engine.",
    "You analyze an entire real estate portfolio to identify macroeconomic trends, systemic risks, and cross-project strategic opportunities.",
    "",
    "You will receive a JSON payload containing aggregated portfolio data: score distributions, common failure patterns, and high-impact improvement levers across the whole group of evaluated projects.",
    "",
    "Your objective is to produce a markdown-formatted executive briefing:",
    "1. 'Macro Overview': A summary of the portfolio overall health and the prevailing market tier distributions.",
    "2. 'Systemic Risks': Analysis of the Failure Patterns, identifying repeated flaws in execution, financial viability, or design across multiple projects.",
    "3. 'Strategic Directives': Actionable directives derived from the Improvement Levers, providing guidance to the C-suite on how to lift the portfolio total value.",
    "",
    "Output only valid Markdown formatting. Keep it highly analytical, objective, and extremely professional. Use bolding to highlight key metrics."
  ].join("\\n");
  const userPrompt = [
    "Portfolio Analytics Payload:",
    JSON.stringify(payload, null, 2),
    "",
    "Provide the Portfolio Intelligence Executive Briefing."
  ].join("\\n");
  try {
    const result = await invokeLLM({
      messages: [
        { role: "system", content: sysPrompt },
        { role: "user", content: userPrompt }
      ]
    });
    const choice = result.choices[0];
    let markdown = "Analysis could not be generated.";
    if (choice.message?.content) {
      markdown = choice.message.content;
    } else if (choice.text) {
      markdown = choice.text;
    }
    return markdown;
  } catch (err) {
    console.error("Portfolio Engine Error:", err);
    return "**Error generating portfolio insights:** " + err.message;
  }
}

// server/routers/autonomous.ts
var autonomousRouter = router({
  getAlerts: protectedProcedure.input(z14.object({
    severity: z14.string().optional(),
    type: z14.string().optional(),
    status: z14.enum(["active", "acknowledged", "resolved", "expired"]).optional()
  }).optional()).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return [];
    let conditions = [];
    const targetStatus = input?.status || "active";
    conditions.push(eq11(platformAlerts.status, targetStatus));
    if (input?.severity) {
      conditions.push(eq11(platformAlerts.severity, input.severity));
    }
    if (input?.type) {
      conditions.push(eq11(platformAlerts.alertType, input.type));
    }
    return db.select().from(platformAlerts).where(conditions.length > 0 ? and5(...conditions) : void 0).orderBy(desc6(platformAlerts.createdAt));
  }),
  acknowledgeAlert: protectedProcedure.input(z14.object({ id: z14.number() })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new Error("Database error");
    await db.update(platformAlerts).set({
      status: "acknowledged",
      acknowledgedBy: ctx.user.id,
      acknowledgedAt: /* @__PURE__ */ new Date()
    }).where(eq11(platformAlerts.id, input.id));
    return { success: true };
  }),
  resolveAlert: protectedProcedure.input(z14.object({ id: z14.number() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("Database error");
    await db.update(platformAlerts).set({
      status: "resolved"
    }).where(eq11(platformAlerts.id, input.id));
    return { success: true };
  }),
  nlQuery: protectedProcedure.input(z14.object({ query: z14.string() })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError7({ code: "INTERNAL_SERVER_ERROR", message: "Database error" });
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1e3);
    const recentQueries = await db.select({ count: sql6`count(*)` }).from(nlQueryLog).where(
      and5(
        eq11(nlQueryLog.userId, ctx.user.id),
        sql6`${nlQueryLog.createdAt} > ${oneHourAgo}`
      )
    );
    const count = Number(recentQueries[0]?.count || 0);
    if (count >= 20) {
      throw new TRPCError7({
        code: "TOO_MANY_REQUESTS",
        message: "Natural language query limit: 20 queries/hour"
      });
    }
    const result = await processNlQuery(ctx.user.id, input.query);
    return result;
  }),
  generateBrief: protectedProcedure.input(z14.object({ projectId: z14.number() })).mutation(async ({ input }) => {
    const briefMarkdown = await generateAutonomousDesignBrief(input.projectId);
    return { markdown: briefMarkdown };
  }),
  portfolioInsights: protectedProcedure.query(async () => {
    const markdown = await generatePortfolioInsights();
    return { markdown };
  })
});

// server/routers/organization.ts
import { z as z15 } from "zod";
import { TRPCError as TRPCError8 } from "@trpc/server";
import { eq as eq12, and as and6 } from "drizzle-orm";
import { nanoid as nanoid5 } from "nanoid";
var organizationRouter = router({
  createOrg: protectedProcedure.input(z15.object({
    name: z15.string().min(2),
    slug: z15.string().min(2).regex(/^[a-z0-9-]+$/),
    domain: z15.string().optional()
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError8({ code: "INTERNAL_SERVER_ERROR", message: "DB unconnected" });
    const existing = await db.select().from(organizations).where(eq12(organizations.slug, input.slug)).limit(1);
    if (existing.length > 0) {
      throw new TRPCError8({ code: "CONFLICT", message: "Slug is already taken" });
    }
    const [orgResult] = await db.insert(organizations).values({
      name: input.name,
      slug: input.slug,
      domain: input.domain ?? null,
      plan: "free"
    });
    const orgId = Number(orgResult.insertId);
    await db.insert(organizationMembers).values({
      orgId,
      userId: ctx.user.id,
      role: "admin"
    });
    await db.update(users).set({ orgId }).where(eq12(users.id, ctx.user.id));
    return { success: true, orgId };
  }),
  myOrgs: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    const result = await db.select({
      org: organizations,
      role: organizationMembers.role
    }).from(organizationMembers).innerJoin(organizations, eq12(organizations.id, organizationMembers.orgId)).where(eq12(organizationMembers.userId, ctx.user.id));
    return result;
  }),
  inviteMember: orgProcedure.input(z15.object({
    email: z15.string().email(),
    role: z15.enum(["admin", "member", "viewer"])
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError8({ code: "INTERNAL_SERVER_ERROR" });
    const myMembership = await db.select().from(organizationMembers).where(and6(eq12(organizationMembers.orgId, ctx.orgId), eq12(organizationMembers.userId, ctx.user.id))).limit(1);
    if (!myMembership[0] || myMembership[0].role !== "admin") {
      throw new TRPCError8({ code: "FORBIDDEN", message: "Only admins can invite members" });
    }
    const token = nanoid5(32);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1e3);
    await db.insert(organizationInvites).values({
      orgId: ctx.orgId,
      email: input.email,
      role: input.role,
      token,
      expiresAt
    });
    console.log(`[Email Mock] Sending invite to ${input.email}: http://localhost:5173/accept-invite?token=${token}`);
    return { success: true, token };
  }),
  acceptInvite: protectedProcedure.input(z15.object({ token: z15.string() })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError8({ code: "INTERNAL_SERVER_ERROR" });
    const inviteResult = await db.select().from(organizationInvites).where(eq12(organizationInvites.token, input.token)).limit(1);
    const invite = inviteResult[0];
    if (!invite) throw new TRPCError8({ code: "NOT_FOUND", message: "Invalid invite token" });
    if (invite.expiresAt < /* @__PURE__ */ new Date()) throw new TRPCError8({ code: "BAD_REQUEST", message: "Invite expired" });
    await db.insert(organizationMembers).values({
      orgId: invite.orgId,
      userId: ctx.user.id,
      role: invite.role
    });
    await db.update(users).set({ orgId: invite.orgId }).where(eq12(users.id, ctx.user.id));
    await db.delete(organizationInvites).where(eq12(organizationInvites.id, invite.id));
    return { success: true, orgId: invite.orgId };
  })
});

// server/routers/economics.ts
import { z as z16 } from "zod";

// server/engines/economic/cost-avoidance.ts
function calculateCostAvoidance(tier, scale, totalBudgetAed, complexityScore) {
  const probability = Math.min(0.5, 0.15 + complexityScore * 35e-4);
  const costOfChangeMultiplier = tier === "Ultra-luxury" ? 0.25 : tier === "Luxury" ? 0.2 : 0.18;
  const costOfChange = totalBudgetAed * costOfChangeMultiplier;
  const scopeRatio = scale === "Large" ? 0.4 : scale === "Medium" ? 0.6 : 0.85;
  const reworkCostAvoided = probability * costOfChange * scopeRatio;
  return {
    reworkCostAvoided: Number(reworkCostAvoided.toFixed(2)),
    probabilityPercent: Number((probability * 100).toFixed(1)),
    estimatedReplacementCost: Number(costOfChange.toFixed(2)),
    scopeImpactRatio: Number(scopeRatio.toFixed(2))
  };
}

// server/engines/economic/programme-acceleration.ts
function calculateProgrammeAcceleration(totalDevelopmentValue, tier, decisionSpeedAdjustment = 1) {
  const baselineDaysSaved = tier === "Ultra-luxury" ? 60 : tier === "Luxury" ? 45 : 30;
  const actualDaysSaved = baselineDaysSaved * decisionSpeedAdjustment;
  const annualFinancingCost = totalDevelopmentValue * 0.08;
  const dailyCarryCost = annualFinancingCost / 365;
  const accelerationValue = actualDaysSaved * dailyCarryCost;
  return {
    programmeAccelerationValue: Number(accelerationValue.toFixed(2)),
    daysSaved: Number(actualDaysSaved.toFixed(0)),
    dailyCarryCost: Number(dailyCarryCost.toFixed(2))
  };
}

// server/engines/economic/roi-calculator.ts
function calculateProjectRoi(params) {
  const {
    tier,
    scale,
    totalBudgetAed,
    totalDevelopmentValue,
    complexityScore,
    decisionSpeedAdjustment = 1,
    serviceFeeAed
  } = params;
  const costAvoidance = calculateCostAvoidance(tier, scale, totalBudgetAed, complexityScore);
  const acceleration = calculateProgrammeAcceleration(totalDevelopmentValue, tier, decisionSpeedAdjustment);
  const totalValueCreated = costAvoidance.reworkCostAvoided + acceleration.programmeAccelerationValue;
  const netRoiPercent = serviceFeeAed > 0 ? (totalValueCreated - serviceFeeAed) / serviceFeeAed * 100 : 0;
  const confidenceMultiplier = complexityScore > 80 ? 0.85 : complexityScore > 60 ? 0.9 : 0.95;
  const riskAdjustedValue = totalValueCreated * confidenceMultiplier;
  return {
    reworkCostAvoided: costAvoidance.reworkCostAvoided,
    programmeAccelerationValue: acceleration.programmeAccelerationValue,
    totalValueCreated: Number(totalValueCreated.toFixed(2)),
    riskAdjustedValue: Number(riskAdjustedValue.toFixed(2)),
    netRoiPercent: Number(netRoiPercent.toFixed(2)),
    confidenceMultiplier: Number(confidenceMultiplier.toFixed(3)),
    breakdown: {
      costAvoidance,
      acceleration
    }
  };
}

// server/engines/risk/risk-evaluator.ts
function evaluateRiskSurface(params) {
  const { domain, tier, horizon, location, complexityScore } = params;
  let baseProbability = 50;
  let baseImpact = 50;
  let baseVulnerability = 50;
  let controlStrength = 60;
  switch (domain) {
    case "Commercial":
      baseProbability = tier === "Ultra-luxury" ? 80 : tier === "Luxury" ? 65 : 40;
      baseImpact = complexityScore > 75 ? 90 : 60;
      baseVulnerability = horizon.includes("36m") ? 85 : 50;
      controlStrength = 70;
      break;
    case "Operational":
      baseProbability = location === "Emerging" ? 75 : 45;
      baseImpact = tier.includes("luxury") ? 85 : 55;
      baseVulnerability = complexityScore;
      controlStrength = 55;
      break;
    case "Strategic":
      baseProbability = tier === "Mid" ? 70 : 40;
      baseImpact = 95;
      baseVulnerability = horizon.includes("36m") ? 80 : 40;
      controlStrength = 40;
      break;
    default:
      baseProbability = 50;
      baseImpact = 50;
      baseVulnerability = 50;
  }
  const rUnbounded = baseProbability * baseImpact * baseVulnerability / controlStrength;
  let compositeRiskScore = Math.floor(rUnbounded / 200);
  if (compositeRiskScore > 100) compositeRiskScore = 100;
  if (compositeRiskScore < 1) compositeRiskScore = 1;
  let riskBand;
  if (compositeRiskScore <= 20) riskBand = "Minimal";
  else if (compositeRiskScore <= 40) riskBand = "Controlled";
  else if (compositeRiskScore <= 60) riskBand = "Elevated";
  else if (compositeRiskScore <= 80) riskBand = "Critical";
  else riskBand = "Systemic";
  return {
    domain,
    probability: baseProbability,
    impact: baseImpact,
    vulnerability: baseVulnerability,
    controlStrength,
    compositeRiskScore,
    riskBand
  };
}

// server/engines/risk/stress-tester.ts
function simulateStressTest(condition, baselineBudgetAed, tier) {
  let impactMagnitudePercent = 0;
  let resilienceScore = 100;
  let failurePoints = [];
  switch (condition) {
    case "cost_surge":
      impactMagnitudePercent = 20;
      break;
    case "demand_collapse":
      impactMagnitudePercent = -50;
      break;
    case "market_shift":
      impactMagnitudePercent = -15;
      break;
    case "data_disruption":
      impactMagnitudePercent = 0;
      break;
  }
  if (condition === "cost_surge") {
    resilienceScore = tier === "Ultra-luxury" ? 85 : tier === "Luxury" ? 70 : 45;
    if (resilienceScore < 60) {
      failurePoints.push("margin_protection", "finishing_budget_saturation");
    }
  }
  if (condition === "demand_collapse") {
    resilienceScore = tier === "Ultra-luxury" ? 40 : tier === "Luxury" ? 50 : 80;
    if (resilienceScore < 60) {
      failurePoints.push("sales_velocity", "carry_cost_overrun");
    }
  }
  if (condition === "market_shift") {
    resilienceScore = 65;
    failurePoints.push("design_obsolescence");
  }
  if (condition === "data_disruption") {
    resilienceScore = 50;
    failurePoints.push("model_robustness", "confidence_interval");
  }
  return {
    stressCondition: condition,
    impactMagnitudePercent,
    resilienceScore,
    failurePoints
  };
}

// server/engines/autonomous/scenario-ranking.ts
function rankScenarios(scenarios2) {
  const scoredScenarios = scenarios2.map((scenario) => {
    const roiScore = Math.min(scenario.netRoiPercent, 100);
    const riskInverted = 100 - scenario.compositeRiskScore;
    const strategicRankScore = roiScore * 0.5 + scenario.avgResilienceScore * 0.3 + riskInverted * 0.2;
    return {
      ...scenario,
      strategicRankScore: Number(strategicRankScore.toFixed(2))
    };
  });
  return scoredScenarios.sort((a, b) => b.strategicRankScore - a.strategicRankScore);
}

// server/routers/economics.ts
var economicsRouter = router({
  calculateRoi: publicProcedure.input(z16.object({
    tier: z16.string(),
    scale: z16.string(),
    totalBudgetAed: z16.number(),
    totalDevelopmentValue: z16.number(),
    complexityScore: z16.number(),
    decisionSpeedAdjustment: z16.number().optional().default(1),
    serviceFeeAed: z16.number()
  })).query(({ input }) => {
    return calculateProjectRoi({
      tier: input.tier,
      scale: input.scale,
      totalBudgetAed: input.totalBudgetAed,
      totalDevelopmentValue: input.totalDevelopmentValue,
      complexityScore: input.complexityScore,
      decisionSpeedAdjustment: input.decisionSpeedAdjustment,
      serviceFeeAed: input.serviceFeeAed
    });
  }),
  evaluateRisk: publicProcedure.input(z16.object({
    domain: z16.enum([
      "Model",
      "Operational",
      "Commercial",
      "Technology",
      "Data",
      "Behavioural",
      "Strategic",
      "Regulatory"
    ]),
    tier: z16.string(),
    horizon: z16.string(),
    location: z16.string(),
    complexityScore: z16.number()
  })).query(({ input }) => {
    return evaluateRiskSurface({
      domain: input.domain,
      tier: input.tier,
      horizon: input.horizon,
      location: input.location,
      complexityScore: input.complexityScore
    });
  }),
  runStressTest: publicProcedure.input(z16.object({
    condition: z16.enum(["demand_collapse", "cost_surge", "data_disruption", "market_shift"]),
    baselineBudgetAed: z16.number(),
    tier: z16.string()
  })).query(({ input }) => {
    return simulateStressTest(
      input.condition,
      input.baselineBudgetAed,
      input.tier
    );
  }),
  rankScenarios: publicProcedure.input(z16.object({
    scenarios: z16.array(z16.object({
      scenarioId: z16.number(),
      name: z16.string(),
      netRoiPercent: z16.number(),
      avgResilienceScore: z16.number(),
      compositeRiskScore: z16.number()
    }))
  })).query(({ input }) => {
    return rankScenarios(input.scenarios);
  })
});

// server/routers.ts
var appRouter = router({
  system: systemRouter,
  auth: authRouter,
  project: projectRouter,
  scenario: scenarioRouter,
  admin: adminRouter,
  seed: seedRouter,
  design: designRouter,
  intelligence: intelligenceRouter,
  marketIntel: marketIntelligenceRouter,
  ingestion: ingestionRouter,
  analytics: analyticsRouter,
  predictive: predictiveRouter,
  learning: learningRouter,
  autonomous: autonomousRouter,
  organization: organizationRouter,
  economics: economicsRouter
});

// server/_core/context.ts
async function createContext(opts) {
  let user = null;
  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    user = null;
  }
  return {
    req: opts.req,
    res: opts.res,
    user
  };
}

// api-src/index.ts
var app = express();
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
registerOAuthRoutes(app);
app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext
  })
);
var index_default = app;
export {
  index_default as default
};
