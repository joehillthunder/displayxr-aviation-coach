// The instructor's tool surface, described once and shared by every adapter. Each adapter maps these
// to its own wire format (Anthropic `input_schema`, OpenAI Realtime / chat `parameters`).

export function toolDefs(knowledge) {
  const partIds = knowledge.parts.map((p) => p.id);
  const procIds = knowledge.procedures.map((p) => p.id);
  const partParam = {
    type: 'object',
    properties: { id: { type: 'string', enum: partIds, description: 'Part id from the training material.' } },
    required: ['id'],
    additionalProperties: false,
  };
  const none = { type: 'object', properties: {}, additionalProperties: false };
  return [
    {
      name: 'start_procedure',
      description: 'Begin a procedure from the training material at step 1 and show its checklist.',
      parameters: {
        type: 'object',
        properties: { id: { type: 'string', enum: procIds } },
        required: ['id'],
        additionalProperties: false,
      },
    },
    {
      name: 'focus_part',
      description: 'Fly the camera to a part so the trainee is looking straight at it.',
      parameters: partParam,
    },
    {
      name: 'highlight_part',
      description: 'Highlight a part on the 3D model and label it.',
      parameters: partParam,
    },
    { name: 'next_step', description: 'Advance to the next step of the active procedure.', parameters: none },
    { name: 'prev_step', description: 'Go back to the previous step of the active procedure.', parameters: none },
    {
      name: 'explain_step',
      description: 'Return the full text of the current step, its parts, its check question and its sources.',
      parameters: none,
    },
    {
      name: 'quiz_me',
      description: 'Start a find-the-part quiz question: name a part and wait for the trainee to click it.',
      parameters: none,
    },
    { name: 'show_source', description: 'Show the source citations for the current step or part.', parameters: none },
  ];
}

export function systemPrompt(knowledge) {
  const t = knowledge.training;
  const p = knowledge.parts[0];
  const pr = knowledge.procedures[0];
  return [
    `You are the instructor at a glasses-free 3D aviation training station. Lesson: ${t?.title || 'Engine 100-hour inspection'}.`,
    `A trainee is looking at ${t?.subject || 'a horizontally opposed piston engine'} and talking to you.`,
    '',
    'Grounding rules:',
    '- Answer only from the TRAINING MATERIAL below. Do not add torques, limits, intervals, part numbers or procedures that are not in it.',
    `- If the material does not cover the question, reply exactly: "That's not in the training material." You may add one short sentence pointing to the manufacturer's manuals or a certificated mechanic.`,
    `- Every answer that states a fact cites it with the tokens shown in the material, such as [part:${p.id}] or [step:${pr.id}/${pr.steps[0].id}]. Put citations at the end of the sentence they support.`,
    '- This is a training demo, not approved maintenance data. Never present an answer as authorization to perform maintenance or as a substitute for the aircraft\'s own checklist and manuals.',
    '',
    'Teaching style: short spoken sentences, one idea at a time. Use the tools to move the camera, highlight parts and step through procedures rather than describing where things are. When a step names parts, focus the first one.',
    '',
    'TRAINING MATERIAL',
    knowledge.materialText(),
  ].join('\n');
}
