import { runPlacement, generateQuiz } from './ai.js';

const userHint = document.getElementById('userHint');
const getPlacement = document.getElementById('getPlacement');
const genQuiz = document.getElementById('genQuiz');
const qCount = document.getElementById('qCount');
const status = document.getElementById('status');

const quizCard = document.getElementById('quizCard');
const detectedLevelEl = document.getElementById('detectedLevel');
const progressEl = document.getElementById('progress');
const questionArea = document.getElementById('questionArea');
const prevBtn = document.getElementById('prev');
const nextBtn = document.getElementById('next');
const submitBtn = document.getElementById('submitQuiz');
const resultsEl = document.getElementById('results');
const backBtn = document.getElementById('back');

let state = {
  level: null,
  quiz: [],
  answers: [],
  index: 0
};

getPlacement.addEventListener('click', async () => {
  status.textContent = 'Detecting level…';
  getPlacement.disabled = true;
  try {
    const res = await runPlacement(userHint.value || '');
    state.level = res.level;
    detectedLevelEl.textContent = `Level: ${res.level}`;
    status.textContent = `Placement: ${res.summary}`;
    genQuiz.disabled = false;
  } catch (e) {
    status.textContent = 'Error detecting level.';
    console.error(e);
  } finally { getPlacement.disabled = false; }
});

genQuiz.addEventListener('click', async () => {
  const n = parseInt(qCount.value,10);
  status.textContent = `Generating ${n}-question quiz… (may take ~10s)`;
  genQuiz.disabled = true;
  try {
    const quiz = await generateQuiz(state.level || 'B1', n, userHint.value || '');
    state.quiz = quiz;
    state.answers = Array(quiz.length).fill(null);
    state.index = 0;
    openQuiz();
  } catch (e) {
    status.textContent = 'Error generating quiz.';
    console.error(e);
  } finally { genQuiz.disabled = false; }
});

function openQuiz(){
  document.getElementById('placement').classList.add('hidden');
  quizCard.classList.remove('hidden');
  resultsEl.classList.add('hidden');
  renderQuestion();
  updateControls();
}

function renderQuestion(){
  const q = state.quiz[state.index];
  progressEl.textContent = `${state.index+1} / ${state.quiz.length}`;
  questionArea.innerHTML = '';
  if(!q) return;
  const box = document.createElement('div'); box.className='qbox';
  const qEl = document.createElement('div'); qEl.className='question'; qEl.textContent = `${state.index+1}. ${q.question}`;
  box.appendChild(qEl);
  if(q.type === 'mcq'){
    const choices = document.createElement('div'); choices.className='choices';
    q.choices.forEach((c,i)=>{
      const cEl = document.createElement('div');
      cEl.className = 'choice' + (state.answers[state.index]===i ? ' selected' : '');
      cEl.textContent = c;
      cEl.addEventListener('click', ()=> {
        state.answers[state.index] = i;
        renderQuestion();
        updateControls();
      });
      choices.appendChild(cEl);
    });
    box.appendChild(choices);
  } else if(q.type === 'open'){
    const ta = document.createElement('textarea');
    ta.style.width='100%'; ta.style.minHeight='100px'; ta.value = state.answers[state.index] || '';
    ta.addEventListener('input', ()=> { state.answers[state.index]=ta.value; updateControls(); });
    box.appendChild(ta);
  }
  questionArea.appendChild(box);
}

prevBtn.addEventListener('click', ()=> {
  if(state.index>0){ state.index--; renderQuestion(); updateControls(); }
});
nextBtn.addEventListener('click', ()=> {
  if(state.index < state.quiz.length-1){ state.index++; renderQuestion(); updateControls(); }
});
submitBtn.addEventListener('click', async ()=> {
  submitBtn.disabled = true;
  progressEl.textContent = 'Checking answers…';
  // simple auto-check for MCQs using provided keys
  let correct=0;
  const details = [];
  state.quiz.forEach((q,i)=>{
    const given = state.answers[i];
    let ok=false;
    if(q.type==='mcq'){
      ok = (given === q.key);
    } else {
      // open questions handled as "manual / model-assisted" — mark as N/A
      ok = null;
    }
    if(ok===true) correct++;
    details.push({question:q.question, given, ok, key:q.key, answerText: q.choices ? q.choices[q.key] : q.answer});
  });
  const score = Math.round((correct / state.quiz.filter(q=>q.type==='mcq').length) * 100) || 0;
  resultsEl.classList.remove('hidden');
  resultsEl.innerHTML = `<strong>Score (MCQs): ${correct} correct — ${score}%</strong><div style="margin-top:8px;font-size:13px;color:var(--muted)">Open questions require manual review; answers are shown below.</div>`;
  // show brief list
  const list = document.createElement('div'); list.style.marginTop='10px';
  details.forEach((d,idx)=>{
    const row = document.createElement('div'); row.style.padding='8px 0'; row.style.borderTop='1px solid #eef3ff';
    row.innerHTML = `<div style="font-weight:600">${idx+1}. ${d.question}</div><div style="font-size:13px;color:${d.ok===true?'var(--success)':'#c0392b'}">Your answer: ${d.given===null?'<em>no answer</em>':(d.given===null?'-':(state.quiz[idx].choices ? (state.quiz[idx].choices[d.given]||'') : d.given))}</div><div style="font-size:13px;color:var(--muted)">Correct: ${d.answerText}</div>`;
    list.appendChild(row);
  });
  resultsEl.appendChild(list);
  submitBtn.disabled = false;
});

backBtn.addEventListener('click', ()=> {
  document.getElementById('placement').classList.remove('hidden');
  quizCard.classList.add('hidden');
  status.textContent = '';
  genQuiz.disabled = false;
});

function updateControls(){
  prevBtn.disabled = state.index===0;
  nextBtn.disabled = state.index===state.quiz.length-1;
  submitBtn.disabled = state.quiz.length===0 || state.answers.every(a=>a===null);
}