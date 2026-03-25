
-- Timestamp update function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'instructor')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Courses table
CREATE TABLE public.courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  time_limit_minutes INTEGER NOT NULL DEFAULT 30,
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view published courses" ON public.courses FOR SELECT TO authenticated USING (is_published = true OR instructor_id = auth.uid());
CREATE POLICY "Instructors can create courses" ON public.courses FOR INSERT TO authenticated WITH CHECK (auth.uid() = instructor_id);
CREATE POLICY "Instructors can update own courses" ON public.courses FOR UPDATE TO authenticated USING (auth.uid() = instructor_id);
CREATE POLICY "Instructors can delete own courses" ON public.courses FOR DELETE TO authenticated USING (auth.uid() = instructor_id);

CREATE TRIGGER update_courses_updated_at BEFORE UPDATE ON public.courses
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Questions table
CREATE TABLE public.questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view questions of accessible courses" ON public.questions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.courses WHERE id = course_id AND (is_published = true OR instructor_id = auth.uid())));
CREATE POLICY "Instructors can manage questions" ON public.questions FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.courses WHERE id = course_id AND instructor_id = auth.uid()));
CREATE POLICY "Instructors can update questions" ON public.questions FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.courses WHERE id = course_id AND instructor_id = auth.uid()));
CREATE POLICY "Instructors can delete questions" ON public.questions FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.courses WHERE id = course_id AND instructor_id = auth.uid()));

-- Options table
CREATE TABLE public.options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  option_text TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL DEFAULT false,
  option_order INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE public.options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view options of accessible questions" ON public.options FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.questions q JOIN public.courses c ON q.course_id = c.id
    WHERE q.id = question_id AND (c.is_published = true OR c.instructor_id = auth.uid())
  ));
CREATE POLICY "Instructors can manage options" ON public.options FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.questions q JOIN public.courses c ON q.course_id = c.id
    WHERE q.id = question_id AND c.instructor_id = auth.uid()
  ));
CREATE POLICY "Instructors can update options" ON public.options FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.questions q JOIN public.courses c ON q.course_id = c.id
    WHERE q.id = question_id AND c.instructor_id = auth.uid()
  ));
CREATE POLICY "Instructors can delete options" ON public.options FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.questions q JOIN public.courses c ON q.course_id = c.id
    WHERE q.id = question_id AND c.instructor_id = auth.uid()
  ));

-- Exam attempts table
CREATE TABLE public.exam_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_at TIMESTAMPTZ,
  score NUMERIC,
  total_questions INTEGER,
  correct_answers INTEGER
);

ALTER TABLE public.exam_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own attempts" ON public.exam_attempts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Instructors can view attempts for their courses" ON public.exam_attempts FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.courses WHERE id = course_id AND instructor_id = auth.uid()));
CREATE POLICY "Users can create attempts" ON public.exam_attempts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own attempts" ON public.exam_attempts FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- User answers table
CREATE TABLE public.user_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES public.exam_attempts(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  selected_option_ids UUID[] NOT NULL DEFAULT '{}'
);

ALTER TABLE public.user_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own answers" ON public.user_answers FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.exam_attempts WHERE id = attempt_id AND user_id = auth.uid()));
CREATE POLICY "Users can insert own answers" ON public.user_answers FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.exam_attempts WHERE id = attempt_id AND user_id = auth.uid()));
CREATE POLICY "Users can update own answers" ON public.user_answers FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.exam_attempts WHERE id = attempt_id AND user_id = auth.uid()));
