// supabase/functions/advance-quiz/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } }
);

export const handler = async () => {
  const now = new Date();

  // 1. Fetch all active quizzes where next_question_at <= now
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
    // 2. If the quiz has reached the end, mark it as ended
    if (quiz.current_question_index >= quiz.total_questions) {
      await supabase
        .from('quizzes')
        .update({ status: 'ended', ended_at: now.toISOString() })
        .eq('id', quiz.id);
      continue;
    }

    // 3. Advance to the next question
    const newIndex = quiz.current_question_index + 1;

    // 4. Get the time allowed for the new question
    const { data: question } = await supabase
      .from('questions')
      .select('time_allowed')
      .eq('quiz_id', quiz.id)
      .order('id')
      .range(newIndex, newIndex)
      .single();

    if (!question) {
      console.error(`No question found for quiz ${quiz.id} at index ${newIndex}`);
      continue;
    }

    const timeAllowed = question.time_allowed || 10;
    const newNextAt = new Date(now.getTime() + timeAllowed * 1000);

    // 5. Update the quiz
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