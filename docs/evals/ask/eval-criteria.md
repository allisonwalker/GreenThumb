# Ask eval criteria

Product-facing criteria for whether Ask kept its promise on a single garden question. Machine graders for the golden set live in `RUBRIC.md`; this file is the human rubric those graders implement.

## Product promise

Given a question from the user about the garden, Ask will accurately respond with key information from the catalog, plantings, weather, and open tasks, and will alert the user if that information is not available rather than guessing or hallucinating.

## Eval use case

**Accurately respond with key information from the catalog, plantings, weather, and open tasks.**

The unit under test is one Ask turn: the user’s question plus `finalText` and `toolTrace` against a frozen garden fixture. A passing reply is checkable against those records (or is a correct abstain/clarify). A fluent answer that could be true of some other garden is a fail.

## Rubric

Score each applying row independently. Use **N/A** when the question does not require that source. A case fails if any applying row is Fail.

| Criterion | What good looks like | Scoring | Severity |
| --- | --- | --- | --- |
| Question interpretation | Treats the question as about *this* household garden. Picks the right record type(s): catalog facts vs plantings vs weather vs open tasks. Ambiguous questions (“water it”) ask which crop or location instead of assuming a planting. Does not treat a write request (“log that I watered”) as a successful write. | Pass / Fail. Fail if it answers the wrong kind of question, assumes an unspecified planting, or follows a write instruction. | High |
| Catalog accuracy | Crop traits in the reply match the catalog row from tools (sun preference, watering interval, harvest window, frost, and similar). Paraphrase is allowed only when it means the same stored value (e.g. `full_sun` → “full sun”). Does not substitute generic crop lore (“an inch a week”) for a stored field. | Pass / Fail / N/A. N/A if the question does not need catalog facts. Fail if a catalog value is wrong or invented. | High — invented catalog value is a hard fail |
| Plantings accuracy | What is planted, where, and status match `get_plantings` / the fixture. Names the real planting when asked what is in the garden. Does not invent a crop, bed, or health story for something that is not planted. | Pass / Fail / N/A. N/A if the question does not need planting state. Fail if a planting or location is invented or a real one is contradicted. | High — invented planting is a hard fail |
| Weather accuracy | Weather or forecast claims match stored weather used by the garden (including rain that drives a skip/downgrade). Does not invent a forecast, temperature, or “it’s going to rain / stay dry” story that is not in the records. | Pass / Fail / N/A. N/A if the question does not need weather. Fail if weather is guessed or contradicts stored weather. | High |
| Open task accuracy | Care answers follow the open Today list. Cites the real open task (e.g. skip/downgrade watering Pepper Pot because rain is coming). Does not invent a task, close a task, or tell the user to water today when the open row says skip. | Pass / Fail / N/A. N/A if the question is not about open care/Today work. Fail if the open list is ignored, contradicted, or a task is invented. | High |
| Uncertainty handling | When a field, planting, or task is missing, says so and names what is missing. Does not fill gaps with training knowledge, a health narrative, or a guessed catalog trait. Does not claim the garden was updated when Ask is read-only. | Pass / Fail. Fail if it guesses, hallucinates missing data, or claims a write. | High |
| Output completeness | Includes the key stored facts needed to act on *this* question (the relevant catalog field, planting, weather, and/or open task). Does not stop at generic advice that omits the garden record. Extra warmth or extra read tools are not required. Exact headline wording is not required. | Pass / Fail / N/A. N/A only if the correct behavior is a short refuse/clarify with no further facts. Fail if the right tools ran but the reply omits the load-bearing record. | Medium |

Prose quality, warmth, length, extra read tools, and exact headline wording are not scored on their own.
