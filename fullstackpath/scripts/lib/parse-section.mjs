/**
 * Field extraction for one expanded topic section.
 *
 * The source documents are the specification here. Every field below maps to a
 * labelled block that actually appears in the roadmap text, and each one exists
 * because it changes what a candidate can do in an interview:
 *
 *   Definition / Why interviewers ask   -> what the topic is and why it is asked
 *   Key concepts                        -> the substance being tested
 *   Common questions + Model answer     -> question and a strong spoken answer
 *   What they evaluate                  -> the grader's rubric
 *   Say out loud                        -> the answer phrased for speaking
 *   Probe                               -> the follow-up they will drill into
 *   Common wrong answers                -> answers that disqualify you
 *   Trade-offs                          -> the depth signal
 *   Prerequisites                       -> what must come first
 *   Symptom / Investigation / Root cause
 *   / Fix / Prevention / Tools          -> the debugging-runbook archetype
 *
 * Nothing is generated: if the source does not state a field, the field is absent
 * rather than filled with a plausible-sounding default.
 */

// Maps a bold section label to the field it populates. Order matters: longer and
// more specific labels must be tested before shorter prefixes.
const FIELD_BY_LABEL = [
  ["why interviewers ask", "whyAsked"],
  ["why interviewers care", "whyAsked"],
  ["why interviewers", "whyAsked"],
  ["what they evaluate", "evaluation"],
  ["what the interviewer evaluates", "evaluation"],
  ["evaluation rubric", "evaluation"],
  ["evaluation", "evaluation"],
  ["what they look for", "evaluation"],
  ["interview signal", "interviewSignal"],
  ["what it implies", "interviewSignal"],
  ["say out loud", "sayOutLoud"],
  ["golden rule", "sayOutLoud"],
  ["in interviews", "sayOutLoud"],
  ["common wrong answers", "wrongAnswers"],
  ["common wrong answer", "wrongAnswers"],
  ["avoid", "wrongAnswers"],
  ["trade-offs", "tradeoffs"],
  ["tradeoffs", "tradeoffs"],
  ["where they help", "tradeoffs"],
  ["prerequisite", "prerequisites"],
  ["probe", "probe"],
  ["key concepts", "keyConcepts"],
  ["concepts", "keyConcepts"],
  ["important concepts", "keyConcepts"],
  ["definition", "definition"],
  ["what it is", "definition"],
  ["what is it", "definition"],
  // Structural prose labels the expanded edition uses heavily.
  //
  // "bodyOnly" means: keep whatever prose follows as concepts, but discard the
  // label text itself. Without it an unrecognised label was treated as a concept
  // name *and* its paragraph was dropped, because prose is only collected for a
  // known open field. That produced prompts like
  // "Explain production considerations and when you would use it."
  ["mechanics", "bodyOnly"],
  ["how it works", "bodyOnly"],
  ["how it works under the hood", "bodyOnly"],
  ["internals", "bodyOnly"],
  ["why it exists", "bodyOnly"],
  ["why it is there", "bodyOnly"],
  ["what problem it solves", "bodyOnly"],
  ["the core idea", "bodyOnly"],
  ["core idea", "bodyOnly"],
  ["in practice", "bodyOnly"],
  ["how to think about it", "bodyOnly"],
  ["intuition", "bodyOnly"],
  ["production considerations", "bodyOnly"],
  ["production concerns", "bodyOnly"],
  ["when to use vs when not to", "bodyOnly"],
  ["when to use vs not", "bodyOnly"],
  ["when to use", "bodyOnly"],
  ["when not to use", "bodyOnly"],
  ["when to use it", "bodyOnly"],
  ["when not to use it", "bodyOnly"],
  ["what you need to know", "bodyOnly"],
  ["what to know first", "bodyOnly"],
  ["key difference", "bodyOnly"],
  ["interviewer probes", "bodyOnly"],
  ["what an interviewer probes", "bodyOnly"],
  ["what they probe", "bodyOnly"],
  ["they will probe", "bodyOnly"],
  ["follow-up probes", "bodyOnly"],
  ["strong answer", "bodyOnly"],
  ["model reasoning", "bodyOnly"],
  ["analysis", "bodyOnly"],
  ["architecture", "bodyOnly"],
  ["requirements", "bodyOnly"],
  ["weak answer", "wrongAnswers"],
  ["hypotheses", "symptoms"],
  ["discriminating tests", "investigation"],
  ["what to notice", "symptoms"],
  ["instrumentation", "tools"],
  ["broken code", "tools"],
  ["real config/code", "tools"],
  ["common mistake", "mistakes"],
  ["mistakes", "mistakes"],
  ["common mistakes", "mistakes"],
  ["mini task", "practice"],
  ["mini tasks", "practice"],
  ["action steps", "practice"],
  ["actionable", "practice"],
  ["how to practice", "practice"],
  ["setup", "practice"],
  ["self-check", "selfCheck"],
  ["self check", "selfCheck"],
  ["common questions", "questions"],
  ["interview questions", "questions"],
  ["questions", "questions"],
  ["questions to ask", "questions"],
  ["resources", "resources"],
  ["model answer", "modelAnswer"],
  ["typical tasks", "practice"],
  ["what happens", "symptoms"],
  ["symptom", "symptoms"],
  ["symptoms", "symptoms"],
  ["investigation", "investigation"],
  ["root cause", "rootCause"],
  ["fix", "fix"],
  ["prevention", "prevention"],
  ["tools", "tools"],
  ["likely causes", "symptoms"],
  ["possible causes", "symptoms"],
];

/** Labels that start a new sub-block but are not interview fields. */
const IGNORED_LABELS = new Set([
  "template per topic",
  "template for technical topics",
  "template for non-technical topics",
  "evaluate a resource",
  "evaluating a resource",
  "if you have no numbers",
  "next up",
  "part 1 is complete",
  "part 2 of phase 3 is complete",
  "phase 2 is complete",
  "part 1 of phase 3 is complete",
  "how to choose",
  "tailoring",
]);

/** `Model answer, Q3:` -> question index 3. */
const MODEL_ANSWER_RE = /^\s*model answer,?\s*q\.?\s*(\d+)/i;
/** `Common questions` numbered list index -> question number. */
const NUMBERED_RE = /^\s*(\d+)[.)]\s+(.*)$/;

function fieldForLabel(label) {
  const normalized = label
    .toLowerCase()
    .replace(/[.:,]+$/, "")
    .replace(/\s+/g, " ")
    .trim();

  if (IGNORED_LABELS.has(normalized)) return "ignored";
  for (const [prefix, field] of FIELD_BY_LABEL) {
    // Prefix match rather than exact match: authors write both "Mistakes" and
    // "Common mistakes", "Prerequisite" and "Prerequisites". The array is ordered
    // most-specific-first so a short prefix can never shadow a longer one.
    if (normalized === prefix || normalized.startsWith(prefix)) {
      return field;
    }
  }
  return null;
}

function clean(text) {
  return text
    .replace(/`/g, "")
    .replace(/\*\*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Strips the trailing `*(answer)*` an author appended to a question. */
function splitInlineAnswer(text) {
  const match = text.match(/^(.*?\?)\s*\*\((.+)\)\*\s*$/);
  if (!match) return { text: text.trim(), answer: "" };
  return { text: match[1].trim(), answer: match[2].trim() };
}

/** `| a | b |` -> ["a", "b"]. Escaped pipes stay with their cell. */
function splitTableRow(line) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split(/(?<!\\)\|/)
    .map((cell) => cell.trim().replace(/\\\|/g, "|"));
}

/** A separator row is `|---|---|` or `| :-- | --: |`; `---` alone counts too. */
function isTableSeparator(line) {
  return /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line);
}

/**
 * Pulls question/answer pairs out of a markdown table.
 *
 * A large share of the authored rapid-fire and Q&A material is a three-column
 * table (`| # | Question | Key points |`). The line-oriented parser above only
 * understands lists and bold labels, so without this every one of those blocks
 * would reach the app with zero items and its questions would be invisible in
 * the question bank.
 *
 * The first column is treated as an index when it is purely numeric, and the
 * last column is treated as the answer. Returns null when the table does not
 * look like a question table, so callers can keep the raw body.
 */
function parseQuestionTable(lines) {
  const header = splitTableRow(lines[0]);
  if (header.length < 2) return null;

  // The question column is whichever header reads most like a question.
  const questionIndex = header.findIndex((cell) => /question|ask|topic|prompt/i.test(cell));
  if (questionIndex === -1) return null;

  const rows = [];
  for (let i = 2; i < lines.length; i += 1) {
    const cells = splitTableRow(lines[i]);
    if (cells.length < 2) continue;
    const text = clean(cells[questionIndex] ?? "");
    if (!text) continue;
    const answer = clean(cells[cells.length - 1] ?? "");
    // A single-column remainder means the "answer" column is the question itself.
    rows.push({
      number: /^\d+$/.test(cells[0] ?? "") ? Number(cells[0]) : null,
      text,
      answer: answer === text ? "" : answer,
    });
  }

  return rows.length > 0 ? rows : null;
}

/**
 * Fallback for a body that is one or more markdown tables with no labels.
 *
 * Returns question rows so the block still has something to drill, and keeps
 * the raw body so nothing authored is lost from the render.
 */
function parseTablesInBody(body) {
  const questions = [];
  let index = 0;

  while (index < body.length) {
    const line = body[index];
    if (!line.trim().startsWith("|")) {
      index += 1;
      continue;
    }

    // Collect the contiguous table.
    let end = index;
    while (end < body.length && body[end].trim().startsWith("|")) end += 1;
    const tableLines = body.slice(index, end);

    if (tableLines.length >= 3 && isTableSeparator(tableLines[1])) {
      const rows = parseQuestionTable(tableLines);
      if (rows) questions.push(...rows);
    }

    index = end;
  }

  return questions;
}

export function parseSection(body) {
  const out = {
    definition: "",
    whyAsked: "",
    evaluation: [],
    keyConcepts: [],
    mistakes: [],
    practice: [],
    selfCheck: [],
    resources: [],
    questions: [],
    modelAnswer: [],
    sayOutLoud: "",
    interviewSignal: "",
    probe: "",
    wrongAnswers: [],
    tradeoffs: [],
    prerequisites: [],
    symptoms: [],
    investigation: [],
    rootCause: [],
    fix: [],
    prevention: [],
    tools: [],
  };

  // Table-recovered questions, surfaced for coverage reporting.
  const buffers = Object.fromEntries(Object.keys(out).map((key) => [key, []]));
  // Code fences are collected separately and re-assembled into __reference.
  buffers.__reference = [];
  let current = null;
  let inFence = false;
  let fenceLines = [];

  // The source uses two Q&A conventions. One is `1. question` under a
  // `Questions` label, answered by `**Model answer, Q1:**` — matched by number
  // at the end of this function. The other is a `### Q7. question` heading
  // answered by an unnumbered `**Model answer.**` block. The unnumbered form
  // has nothing to match on, so the heading and the answer beneath it are
  // paired here as they stream past.
  let pendingQuestion = null;
  let pendingAnswerLines = [];

  /** Close an open unnumbered model answer, attaching it to its question. */
  const flushPlainAnswer = () => {
    const answer = pendingAnswerLines.join(" ").replace(/\s+/g, " ").trim();
    // Nothing buffered yet: a heading is still waiting for its answer, so the
    // pending question must survive. Only an actual answer consumes it.
    if (!answer) {
      pendingAnswerLines = [];
      return;
    }
    const heading = pendingQuestion;
    pendingAnswerLines = [];
    pendingQuestion = null;
    if (!heading) return;

    const existing = buffers.questions.find(
      (entry) => entry && typeof entry === "object" && entry.number === heading.number,
    );
    if (existing) {
      if (!existing.answer) existing.answer = answer;
      return;
    }
    buffers.questions.push({ number: heading.number, text: heading.text, answer });
  };

  const push = (field, value) => {
    const cleaned = clean(value);
    if (!cleaned) return;
    if (field === "modelAnswer") {
      // Unnumbered model answers are buffered as a block and paired with the
      // heading above them by flushPlainAnswer(), not pushed individually.
      pendingAnswerLines.push(cleaned);
      return;
    }
    if (field === "definition" || field === "whyAsked" || field === "sayOutLoud") {
      if (buffers[field].length === 0) buffers[field].push(cleaned);
      return;
    }
    if (buffers[field]) buffers[field].push(cleaned);
  };

  for (const rawLine of body) {
    // Code fences are captured verbatim as reference material and never parsed
    // as prose, otherwise code examples would pollute the concept list.
    if (rawLine.trim().startsWith("```")) {
      if (inFence) {
        fenceLines.push(rawLine);
        buffers.__reference.push(fenceLines.join("\n"));
        fenceLines = [];
        inFence = false;
      } else {
        inFence = true;
        fenceLines = [rawLine];
      }
      current = null;
      continue;
    }
    if (inFence) {
      fenceLines.push(rawLine);
      continue;
    }

    const line = rawLine.trimEnd();
    if (!line.trim()) {
      // A model answer is one block of prose and is often written as several
      // paragraphs, so a blank line inside one must not end it. The block is
      // closed by the next heading, label or rule instead.
      if (current !== "modelAnswer") current = null;
      continue;
    }

    // A horizontal rule ends any open model-answer block.
    if (/^\s*([-*_]\s*){3,}$/.test(line)) {
      flushPlainAnswer();
      current = null;
      continue;
    }

    // ── `### Q7. question` heading ─────────────────────────────────
    // Only remembered, not turned into a question yet: a heading is adopted
    // when an unnumbered model answer follows it, so ordinary headings in the
    // middle of a topic are never mistaken for interview questions.
    const qHeading = line.match(/^\s*#{2,6}\s*Q\s*(\d+)\s*[.:)]\s*(.+)$/);
    if (qHeading) {
      flushPlainAnswer();
      pendingQuestion = { number: Number(qHeading[1]), text: clean(qHeading[2] ?? "") };
      current = null;
      continue;
    }

    // ── Bold section label ──────────────────────────────────────
    const labelMatch = line.match(/^\*\*([^*]{2,70})\*\*:?\s*(.*)$/);
    if (labelMatch && !line.startsWith("- ")) {
      const rawLabel = labelMatch[1].trim();
      const rest = (labelMatch[2] ?? "").trim();

      // A recognised label ends an open unnumbered model answer.
      const labelField = fieldForLabel(rawLabel);
      const isNumberedModelAnswer = MODEL_ANSWER_RE.test(rawLabel);
      if (!isNumberedModelAnswer) flushPlainAnswer();

      const modelMatch = rawLabel.match(MODEL_ANSWER_RE);
      if (modelMatch) {
        const number = Number(modelMatch[1]);
        const answer = clean(rest);
        if (answer) {
          buffers.modelAnswer.push({ questionNumber: number, answer });
        }
        current = "modelAnswer";
        continue;
      }

      const field = labelField;
      if (field === "ignored") {
        current = null;
        continue;
      }
      // A structural label whose name is not itself a concept: open the concept
      // field for the prose that follows, but do not record the label.
      if (field === "bodyOnly") {
        current = "keyConcepts";
        continue;
      }
      if (field) {
        current = field;
        if (rest) {
          if (field === "definition" || field === "whyAsked" || field === "sayOutLoud") {
            buffers[field].push(clean(rest));
          } else {
            push(field, rest);
          }
        }
        continue;
      }

      // Unlabelled bold sub-heading: it names a concept, so keep the text and
      // treat it as part of whatever field was open. A label that ends in a
      // colon or full stop is a field name, not a concept, so the trailing
      // punctuation is dropped here; otherwise it survives into the UI as
      // "Explain difficulty: and when you would use it."
      if (current) push(current, rawLabel.replace(/\*\*$/, ""));
      else push("keyConcepts", rawLabel.replace(/[:.]\s*$/, ""));
      continue;
    }

    // ── Bullet list ─────────────────────────────────────────────
    if (/^[-*]\s+/.test(line)) {
      const value = line.replace(/^[-*]\s+/, "");

      if (current === "questions") {
        const inline = splitInlineAnswer(value);
        if (inline.answer) {
          buffers.questions.push({ text: inline.text, answer: inline.answer });
        } else {
          buffers.questions.push({ text: inline.text, answer: "" });
        }
        continue;
      }

      if (current === "keyConcepts") {
        // `- **Bold lead:** explanation` — keep the whole thing, it reads well.
        push("keyConcepts", value);
        continue;
      }

      if (current) push(current, value);
      else push("keyConcepts", value);
      continue;
    }

    // ── Numbered list ───────────────────────────────────────────
    const numbered = line.match(NUMBERED_RE);
    if (numbered) {
      const value = numbered[2] ?? "";

      if (current === "questions") {
        const inline = splitInlineAnswer(value);
        buffers.questions.push({
          number: Number(numbered[1]),
          text: inline.text,
          answer: inline.answer,
        });
        continue;
      }

      if (current) push(current, value);
      else push("keyConcepts", value);
      continue;
    }

    // ── Prose ───────────────────────────────────────────────────
    if (current === "definition" || current === "whyAsked" || current === "sayOutLoud") {
      push(current, line);
      continue;
    }
    if (current === "keyConcepts") {
      push("keyConcepts", line);
      continue;
    }
    if (current === "modelAnswer") {
      push("modelAnswer", line);
      continue;
    }
  }

  flushPlainAnswer();

  // Collapse the single-sentence fields.
  out.definition = buffers.definition.join(" ").replace(/\s+/g, " ").trim();
  out.whyAsked = buffers.whyAsked.join(" ").replace(/\s+/g, " ").trim();
  out.sayOutLoud = buffers.sayOutLoud.join(" ").replace(/\s+/g, " ").trim();
  out.interviewSignal = buffers.interviewSignal.join(" ").replace(/\s+/g, " ").trim();

  for (const key of Object.keys(buffers)) {
    if (
      key === "definition" ||
      key === "whyAsked" ||
      key === "sayOutLoud" ||
      key === "interviewSignal" ||
      key === "__reference"
    ) {
      continue;
    }
    out[key] = buffers[key];
  }

  // `Questions` entries lose their `text` wrapper when pushed as plain strings
  // (e.g. a one-line question with no list marker). Normalise both shapes.
  out.questions = out.questions
    .map((entry) =>
      typeof entry === "string"
        ? { number: null, text: entry, answer: "" }
        : entry,
    )
    .filter((entry) => entry.text);

  // Attach model answers to the question they answer, where the numbering lines up.
  for (const model of out.modelAnswer) {
    const target = out.questions.find(
      (question) =>
        (model.questionNumber !== null &&
          question.number === model.questionNumber) ||
        question.text.toLowerCase() === model.questionNumberText?.toLowerCase(),
    );
    if (target && !target.answer) target.answer = model.answer;
  }

  out.__reference = (buffers.__reference ?? []).join("\n\n");

  // ── Table fallback ───────────────────────────────────────────
  // Blocks written as a markdown table carry their content in cells, which the
  // line-oriented pass cannot see. Recover the question rows so rapid-fire and
  // Q&A material is drillable and reachable from the question bank.
  if (out.questions.length === 0) {
    const tableQuestions = parseTablesInBody(body);
    if (tableQuestions.length > 0) {
      out.questions = tableQuestions;
      // The key-points column is a compact model answer, so treat it as one.
      const answered = tableQuestions.filter((question) => question.answer);
      if (answered.length === tableQuestions.length) {
        out.modelAnswer = tableQuestions.map((question) => ({
          questionNumber: question.number,
          answer: question.answer,
        }));
      }
      out.__tableQuestions = tableQuestions.length;
    }
  }

  return out;
}
