/*
  ai.js
  - runPlacement(hint) => { level: "A2/B1/..." , summary: "short explanation" }
  - generateQuiz(level, count, hint) => returns array of questions:
      { type: "mcq" | "open", question: string, choices?: string[], key?: 0-based index, answer?: string }
  Uses global `websim.chat.completions.create` as provided by the runtime.
*/

let conversationHistory = [];

async function callModel(messages, json=false){
  // keep last 10 messages in conversationHistory for context
  conversationHistory.push(...messages.map(m=> ({role:m.role, content:m.content})));
  conversationHistory = conversationHistory.slice(-10);
  const completion = await websim.chat.completions.create({
    messages: [
      // system message to steer the model
      {
        role: "system",
        content: "You are a helpful exam-generation assistant. Produce concise, accurate Cambridge-style questions and map users to CEFR/Cambridge levels. When asked for structured output, respond exactly with JSON (no extra text)."
      },
      ...conversationHistory
    ],
    json: json
  });
  // model output
  return completion.content;
}

export async function runPlacement(hint){
  // ask model to infer level from user hint
  const userPrompt = `User info: """${hint}""". Based on this, give a single Cambridge/CEFR level (A1, A2, B1, B2, C1, C2) and a one-sentence summary explaining why. Respond as JSON: { "level": "B1", "summary": "..." }`;
  const content = [{role:'user', content: userPrompt}];
  const raw = await callModel(content, true);
  try {
    const parsed = JSON.parse(raw);
    return { level: parsed.level || 'B1', summary: parsed.summary || 'Placement based on provided info.' };
  } catch(e){
    // fallback
    return { level: 'B1', summary: 'Could not parse model response; defaulting to B1.' };
  }
}

export async function generateQuiz(level='B1', count=10, hint=''){
  // Request a set of multiple choice + a few open questions depending on level.
  const prompt = `Generate a ${count}-question Cambridge-style practice quiz appropriate for level ${level}. Produce JSON only with this shape:
{
  "level": "<level>",
  "questions": [
    {
      "type": "mcq" | "open",
      "question": "<question text>",
      "choices": ["A","B","C","D"],   // only for mcq
      "key": 0,                       // 0-based index for correct choice (only for mcq)
      "answer": "<model answer>"      // for open questions provide sample answer
    }, ...
  ]
}
Guidelines:
- Make most questions MCQs; include some open questions (short writing) for higher levels.
- Keep questions varied: grammar, vocabulary, reading, short listening-style texts (written).
- Choices must be short and plausible.
- No extraneous text outside JSON.`;
  const content = [{role:'user', content: prompt}, {role:'user', content: `context hint: ${hint}`}];
  const raw = await callModel(content, true);
  try {
    const parsed = JSON.parse(raw);
    // Basic validation and normalization
    const qs = (parsed.questions || []).slice(0, count).map((q)=>{
      if(q.type==='mcq'){
        // ensure keys and choices exist
        return {
          type: 'mcq',
          question: q.question || '',
          choices: q.choices || ["A","B","C","D"],
          key: typeof q.key==='number' ? q.key : 0,
          answer: q.choices ? (q.choices[q.key] || '') : ''
        };
      } else {
        return {
          type: 'open',
          question: q.question || '',
          answer: q.answer || ''
        };
      }
    });
    // If fewer questions returned, pad with simple MCQs
    while(qs.length < count){
      qs.push({
        type:'mcq',
        question: 'Choose the correct form: "She ____ to the store yesterday."',
        choices: ['go', 'goes', 'went', 'gone'],
        key: 2,
        answer: 'went'
      });
    }
    return qs;
  } catch(e){
    // fallback: generate simple MCQs programmatically
    const fallback = [];
    for(let i=0;i<count;i++){
      fallback.push({
        type:'mcq',
        question: `Fallback question ${i+1}: Choose the correct option.`,
        choices:['Option A','Option B','Option C','Option D'],
        key: 0,
        answer: 'Option A'
      });
    }
    return fallback;
  }
}

export { };