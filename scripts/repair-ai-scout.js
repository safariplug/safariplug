const fs = require("fs");

const path = "app/admin/ai-scout/actions/run-scout.ts";
const source = fs.readFileSync(path, "utf8");

const passFunction = `async function runDiscoveryPass(
  openai: OpenAI,
  location: string,
  category: string,
  pass: DiscoveryPass
): Promise<{ events: DiscoveredEvent[]; error: string | null }> {
  try {
    const response = await openai.responses.create({
      model: OPENAI_MODEL,
      tools: [{ type: "web_search" }],
      input: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildPassPrompt(location, category, pass) },
      ],
    });

    const text = response.output_text?.trim();

    if (!text) {
      return { events: [], error: "empty model response" };
    }

    try {
      const parsed = JSON.parse(text) as DiscoveryResponse;

      if (!parsed || !Array.isArray(parsed.events)) {
        return { events: [], error: "invalid discovery response shape" };
      }

      return { events: parsed.events, error: null };
    } catch {
      return { events: [], error: "invalid JSON from discovery pass" };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(\`SCOUT PASS \${pass.name} ERROR:\`, error);
    return { events: [], error: message };
  }
}`;

const functionPattern = /async function runDiscoveryPass[\\s\\S]*?\\nfunction dedupeCandidates/;
if (!functionPattern.test(source)) {
  throw new Error("Could not locate runDiscoveryPass block");
}

let next = source.replace(functionPattern, `${passFunction}\nfunction dedupeCandidates`);

const resultsPattern = /const passResults = await Promise\.all\(passes\.map\(\(pass\) => runDiscoveryPass\(openai, location, category, pass\)\)\);[\\s\\S]*?const candidateEvents = dedupeCandidates\(passResults\.flat\(\)\);/;
const resultsReplacement = `const passResults = await Promise.all(
      passes.map((pass) => runDiscoveryPass(openai, location, category, pass))
    );

    const failedPasses = passResults.filter((result) => result.error);
    const rawCandidateCount = passResults.reduce(
      (sum, result) => sum + result.events.length,
      0
    );

    if (failedPasses.length === passes.length) {
      const details = failedPasses
        .map((result, index) => `${passes[index].name}: ${result.error}`)
        .join("; ");
      throw new Error(`All AI Scout passes failed. ${details}`);
    }

    if (failedPasses.length > 0) {
      console.warn(
        `AI Scout completed with ${failedPasses.length}/${passes.length} failed pass(es):`,
        failedPasses.map((result) => result.error)
      );
    }

    const candidateEvents = dedupeCandidates(
      passResults.flatMap((result) => result.events)
    );`;

if (!resultsPattern.test(next)) {
  throw new Error("Could not locate pass result handling block");
}

next = next.replace(resultsPattern, resultsReplacement);
fs.writeFileSync(path, next, "utf8");
console.log("AI SCOUT RELIABILITY PATCH APPLIED");
