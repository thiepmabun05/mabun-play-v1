import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } }
);

export const handler = async () => {
  const now = new Date();

  // Fetch all active quizzes that are due for the next question
  const { data: quizzes, error } = await supabase
    .from('quizzes')
    .select('id, current_question_index, next_question_at, total_questions')
    .eq('status', 'active')
    .lte('next_question_at', now.toISOString());

  if (error) {
    console.error('Error fetching quizzes:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  if (!quizzes || quizzes.length === 0) {
    return new Response(JSON.stringify({ message: 'No quizzes to advance' }), { status: 200 });
  }

  for (const quiz of quizzes) {
    // If the quiz has reached the end, mark it as ended
    if (quiz.current_question_index >= quiz.total_questions) {
      await supabase
        .from('quizzes')
        .update({ status: 'ended', ended_at: now.toISOString() })
        .eq('id', quiz.id);
      continue;
    }

    // Advance to the next question
    const newIndex = quiz.current_question_index + 1;

    // Get the time allowed for the new question
    const { data: question } = await supabase
      .from('questions')
      .select('time_allowed')
      .eq('quiz_id', quiz.id)
      .order('id')
      .range(newIndex, newIndex)
      .single();

    if (!question) continue;

    const timeAllowed = question.time_allowed || 10;
    const newNextAt = new Date(now.getTime() + timeAllowed * 1000);

    // Update the quiz
    await supabase
      .from('quizzes')
      .update({
        current_question_index: newIndex,
        next_question_at: newNextAt.toISOString(),
      })
      .eq('id', quiz.id);
  }

  return new Response(JSON.stringify({ success: true }), { status: 200 });
};