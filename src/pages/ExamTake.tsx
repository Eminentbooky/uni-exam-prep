import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Clock, ChevronLeft, ChevronRight, Send, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface Option {
  id: string;
  option_text: string;
  is_correct: boolean;
  option_order: number;
}

interface Question {
  id: string;
  question_text: string;
  question_order: number;
  options: Option[];
}

interface Course {
  id: string;
  title: string;
  time_limit_minutes: number;
}

export default function ExamTake() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [course, setCourse] = useState<Course | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<{ score: number; total: number; correct: number } | null>(null);
  const timerRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (id) loadExam(id);
  }, [id]);

  useEffect(() => {
    if (!started || submitted) return;
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [started, submitted]);

  const loadExam = async (courseId: string) => {
    const { data: c } = await supabase.from('courses').select('id, title, time_limit_minutes').eq('id', courseId).single();
    if (!c) return navigate('/');
    setCourse(c);

    const { data: qs } = await supabase
      .from('questions')
      .select('*')
      .eq('course_id', courseId)
      .order('question_order');

    if (qs) {
      const withOptions = await Promise.all(
        qs.map(async (q) => {
          const { data: opts } = await supabase
            .from('options')
            .select('*')
            .eq('question_id', q.id)
            .order('option_order');
          return { ...q, options: opts || [] };
        })
      );
      setQuestions(withOptions);
    }
  };

  const startExam = async () => {
    if (!user || !course) return;
    const { data, error } = await supabase
      .from('exam_attempts')
      .insert({ user_id: user.id, course_id: course.id })
      .select()
      .single();
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    setAttemptId(data.id);
    setTimeLeft(course.time_limit_minutes * 60);
    setStarted(true);
  };

  const toggleOption = (questionId: string, optionId: string) => {
    setAnswers((prev) => {
      const current = prev[questionId] || [];
      const updated = current.includes(optionId)
        ? current.filter((id) => id !== optionId)
        : [...current, optionId];
      return { ...prev, [questionId]: updated };
    });
  };

  const handleSubmit = useCallback(async () => {
    if (!attemptId || submitted) return;
    setSubmitted(true);
    clearInterval(timerRef.current);

    // Calculate score
    let correct = 0;
    for (const q of questions) {
      const selected = answers[q.id] || [];
      const correctIds = q.options.filter((o) => o.is_correct).map((o) => o.id);
      const isCorrect =
        selected.length === correctIds.length &&
        selected.every((id) => correctIds.includes(id));
      if (isCorrect) correct++;

      // Save answer
      await supabase.from('user_answers').insert({
        attempt_id: attemptId,
        question_id: q.id,
        selected_option_ids: selected,
      });
    }

    const score = questions.length > 0 ? (correct / questions.length) * 100 : 0;

    await supabase
      .from('exam_attempts')
      .update({
        submitted_at: new Date().toISOString(),
        score,
        total_questions: questions.length,
        correct_answers: correct,
      })
      .eq('id', attemptId);

    setResult({ score: Math.round(score), total: questions.length, correct });
  }, [attemptId, submitted, questions, answers]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const currentQuestion = questions[currentIndex];
  const isLowTime = timeLeft < 60;
  const answeredCount = Object.keys(answers).filter((k) => answers[k].length > 0).length;

  if (!course) return null;

  // Result screen
  if (submitted && result) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <Card className="w-full max-w-md text-center animate-fade-in">
          <CardHeader>
            <CardTitle className="text-2xl font-display">Exam Complete</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="w-24 h-24 mx-auto rounded-full bg-primary flex items-center justify-center">
              <span className="text-3xl font-bold text-primary-foreground">{result.score}%</span>
            </div>
            <div>
              <p className="text-lg font-semibold text-foreground">{course.title}</p>
              <p className="text-muted-foreground">
                {result.correct} of {result.total} questions correct
              </p>
            </div>
            <Button onClick={() => navigate('/')} className="w-full">Back to Dashboard</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Start screen
  if (!started) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <Card className="w-full max-w-md text-center animate-fade-in">
          <CardHeader>
            <CardTitle className="text-2xl font-display">{course.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Clock className="w-5 h-5" />
              <span>{course.time_limit_minutes} minutes</span>
            </div>
            <p className="text-muted-foreground">{questions.length} questions • Multiple choice (select all correct)</p>
            <div className="bg-secondary/50 rounded-lg p-4 text-sm text-muted-foreground text-left space-y-1">
              <p>• The timer starts when you click "Begin Exam"</p>
              <p>• You can navigate between questions freely</p>
              <p>• The exam auto-submits when time runs out</p>
            </div>
            <Button onClick={startExam} size="lg" className="w-full">Begin Exam</Button>
            <Button variant="ghost" onClick={() => navigate('/')}>Cancel</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Timer bar */}
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-sm font-semibold text-foreground truncate mr-4">{course.title}</h1>
          <div className="flex items-center gap-3">
            <Badge variant="secondary">{answeredCount}/{questions.length} answered</Badge>
            <div className={`flex items-center gap-1 font-mono text-sm font-bold ${isLowTime ? 'text-destructive animate-pulse-gentle' : 'text-foreground'}`}>
              {isLowTime && <AlertTriangle className="w-4 h-4" />}
              <Clock className="w-4 h-4" />
              {formatTime(timeLeft)}
            </div>
          </div>
        </div>
        {/* Progress bar */}
        <div className="h-1 bg-muted">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
          />
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-2xl">
        {currentQuestion && (
          <Card className="animate-fade-in">
            <CardHeader>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                <span>Question {currentIndex + 1} of {questions.length}</span>
              </div>
              <CardTitle className="text-lg leading-relaxed">{currentQuestion.question_text}</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">Select all correct answers</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {currentQuestion.options.map((opt) => {
                const isSelected = (answers[currentQuestion.id] || []).includes(opt.id);
                return (
                  <button
                    key={opt.id}
                    onClick={() => toggleOption(currentQuestion.id, opt.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${
                      isSelected
                        ? 'border-primary bg-primary/5 ring-1 ring-primary'
                        : 'border-border hover:border-muted-foreground/30'
                    }`}
                  >
                    <Checkbox checked={isSelected} />
                    <span className="text-sm text-foreground">{opt.option_text}</span>
                  </button>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-6">
          <Button
            variant="outline"
            onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
            disabled={currentIndex === 0}
          >
            <ChevronLeft className="w-4 h-4 mr-1" /> Previous
          </Button>

          {currentIndex === questions.length - 1 ? (
            <Button onClick={handleSubmit} className="gap-2">
              <Send className="w-4 h-4" /> Submit Exam
            </Button>
          ) : (
            <Button
              onClick={() => setCurrentIndex(Math.min(questions.length - 1, currentIndex + 1))}
            >
              Next <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          )}
        </div>

        {/* Question navigator */}
        <div className="mt-6 flex flex-wrap gap-2 justify-center">
          {questions.map((q, i) => {
            const isAnswered = (answers[q.id] || []).length > 0;
            return (
              <button
                key={q.id}
                onClick={() => setCurrentIndex(i)}
                className={`w-9 h-9 rounded-lg text-xs font-medium transition-all ${
                  i === currentIndex
                    ? 'bg-primary text-primary-foreground'
                    : isAnswered
                    ? 'bg-accent text-accent-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {i + 1}
              </button>
            );
          })}
        </div>
      </main>
    </div>
  );
}
