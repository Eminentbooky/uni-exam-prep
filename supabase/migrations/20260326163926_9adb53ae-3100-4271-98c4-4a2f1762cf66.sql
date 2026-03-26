
-- Add price column to courses
ALTER TABLE public.courses ADD COLUMN price integer NOT NULL DEFAULT 0;

-- Create course_subscriptions table
CREATE TABLE public.course_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  paystack_reference text NOT NULL,
  amount integer NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, course_id, paystack_reference)
);

ALTER TABLE public.course_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscriptions" ON public.course_subscriptions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own subscriptions" ON public.course_subscriptions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can update subscriptions" ON public.course_subscriptions
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
