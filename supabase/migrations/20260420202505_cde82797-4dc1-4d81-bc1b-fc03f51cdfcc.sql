
CREATE TABLE public.attempt_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  attempt_id UUID NOT NULL,
  instructor_id UUID NOT NULL,
  feedback_text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (attempt_id, instructor_id)
);

ALTER TABLE public.attempt_feedback ENABLE ROW LEVEL SECURITY;

-- Instructors can manage feedback on attempts for their own courses
CREATE POLICY "Instructors can view feedback on their courses"
ON public.attempt_feedback FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.exam_attempts ea
    JOIN public.courses c ON c.id = ea.course_id
    WHERE ea.id = attempt_feedback.attempt_id
      AND c.instructor_id = auth.uid()
  )
);

CREATE POLICY "Instructors can create feedback on their courses"
ON public.attempt_feedback FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = instructor_id
  AND EXISTS (
    SELECT 1 FROM public.exam_attempts ea
    JOIN public.courses c ON c.id = ea.course_id
    WHERE ea.id = attempt_feedback.attempt_id
      AND c.instructor_id = auth.uid()
  )
);

CREATE POLICY "Instructors can update own feedback"
ON public.attempt_feedback FOR UPDATE TO authenticated
USING (auth.uid() = instructor_id);

CREATE POLICY "Instructors can delete own feedback"
ON public.attempt_feedback FOR DELETE TO authenticated
USING (auth.uid() = instructor_id);

-- Students can view feedback on their own attempts
CREATE POLICY "Students can view feedback on own attempts"
ON public.attempt_feedback FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.exam_attempts ea
    WHERE ea.id = attempt_feedback.attempt_id
      AND ea.user_id = auth.uid()
  )
);

CREATE TRIGGER update_attempt_feedback_updated_at
BEFORE UPDATE ON public.attempt_feedback
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_attempt_feedback_attempt_id ON public.attempt_feedback(attempt_id);
