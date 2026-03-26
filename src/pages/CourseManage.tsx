import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Plus, Trash2, Save, GripVertical } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';

interface Option {
  id?: string;
  option_text: string;
  is_correct: boolean;
  option_order: number;
}

interface Question {
  id?: string;
  question_text: string;
  question_order: number;
  options: Option[];
}

export default function CourseManage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const isNew = id === 'new';

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [timeLimit, setTimeLimit] = useState(30);
  const [price, setPrice] = useState(0);
  const [isPublished, setIsPublished] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [saving, setSaving] = useState(false);
  const [courseId, setCourseId] = useState<string | null>(isNew ? null : id || null);

  useEffect(() => {
    if (!isNew && id) loadCourse(id);
  }, [id]);

  const loadCourse = async (courseId: string) => {
    const { data: course } = await supabase.from('courses').select('*').eq('id', courseId).single();
    if (!course) return navigate('/');

    setTitle(course.title);
    setDescription(course.description || '');
    setTimeLimit(course.time_limit_minutes);
    setPrice((course as any).price || 0);
    setIsPublished(course.is_published);

    const { data: qs } = await supabase
      .from('questions')
      .select('*')
      .eq('course_id', courseId)
      .order('question_order');

    if (qs) {
      const questionsWithOptions = await Promise.all(
        qs.map(async (q) => {
          const { data: opts } = await supabase
            .from('options')
            .select('*')
            .eq('question_id', q.id)
            .order('option_order');
          return { ...q, options: opts || [] };
        })
      );
      setQuestions(questionsWithOptions);
    }
  };

  const addQuestion = () => {
    setQuestions([
      ...questions,
      {
        question_text: '',
        question_order: questions.length,
        options: [
          { option_text: '', is_correct: false, option_order: 0 },
          { option_text: '', is_correct: false, option_order: 1 },
          { option_text: '', is_correct: false, option_order: 2 },
          { option_text: '', is_correct: false, option_order: 3 },
        ],
      },
    ]);
  };

  const removeQuestion = (index: number) => {
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const updateQuestion = (index: number, text: string) => {
    const updated = [...questions];
    updated[index].question_text = text;
    setQuestions(updated);
  };

  const updateOption = (qIndex: number, oIndex: number, text: string) => {
    const updated = [...questions];
    updated[qIndex].options[oIndex].option_text = text;
    setQuestions(updated);
  };

  const toggleCorrect = (qIndex: number, oIndex: number) => {
    const updated = [...questions];
    updated[qIndex].options[oIndex].is_correct = !updated[qIndex].options[oIndex].is_correct;
    setQuestions(updated);
  };

  const addOption = (qIndex: number) => {
    const updated = [...questions];
    updated[qIndex].options.push({
      option_text: '',
      is_correct: false,
      option_order: updated[qIndex].options.length,
    });
    setQuestions(updated);
  };

  const removeOption = (qIndex: number, oIndex: number) => {
    const updated = [...questions];
    updated[qIndex].options = updated[qIndex].options.filter((_, i) => i !== oIndex);
    setQuestions(updated);
  };

  const handleSave = async () => {
    if (!user || !title.trim()) return;
    setSaving(true);

    try {
      let cId = courseId;

      if (isNew || !cId) {
        const { data, error } = await supabase
          .from('courses')
          .insert({ title, description, time_limit_minutes: timeLimit, is_published: isPublished, instructor_id: user.id, price } as any)
          .select()
          .single();
        if (error) throw error;
        cId = data.id;
        setCourseId(cId);
      } else {
        const { error } = await supabase
          .from('courses')
          .update({ title, description, time_limit_minutes: timeLimit, is_published: isPublished, price } as any)
          .eq('id', cId);
        if (error) throw error;

        // Delete existing questions (cascade deletes options)
        await supabase.from('questions').delete().eq('course_id', cId);
      }

      // Insert questions and options
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        if (!q.question_text.trim()) continue;

        const { data: qData, error: qError } = await supabase
          .from('questions')
          .insert({ course_id: cId!, question_text: q.question_text, question_order: i })
          .select()
          .single();
        if (qError) throw qError;

        const validOptions = q.options.filter((o) => o.option_text.trim());
        if (validOptions.length > 0) {
          const { error: oError } = await supabase
            .from('options')
            .insert(
              validOptions.map((o, j) => ({
                question_id: qData.id,
                option_text: o.option_text,
                is_correct: o.is_correct,
                option_order: j,
              }))
            );
          if (oError) throw oError;
        }
      }

      toast({ title: 'Saved!', description: 'Course and questions have been saved.' });
      if (isNew) navigate(`/course/${cId}/manage`, { replace: true });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/">
              <Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4 mr-1" /> Back</Button>
            </Link>
            <h1 className="text-lg font-display font-bold text-foreground">
              {isNew ? 'New Course' : 'Edit Course'}
            </h1>
          </div>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-3xl space-y-6">
        {/* Course Details */}
        <Card>
          <CardHeader>
            <CardTitle>Course Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Course Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Introduction to Biology" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description of the course exam" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Time Limit (minutes)</Label>
                <Input type="number" value={timeLimit} onChange={(e) => setTimeLimit(Number(e.target.value))} min={1} />
              </div>
              <div className="flex items-center gap-3 pt-6">
                <Switch checked={isPublished} onCheckedChange={setIsPublished} />
                <Label>Published</Label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Questions */}
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-display font-bold text-foreground">Questions ({questions.length})</h2>
          <Button onClick={addQuestion} variant="outline" className="gap-2">
            <Plus className="w-4 h-4" /> Add Question
          </Button>
        </div>

        {questions.map((q, qIndex) => (
          <Card key={qIndex} className="animate-fade-in">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 flex-1">
                  <GripVertical className="w-5 h-5 text-muted-foreground mt-2 flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Label className="text-xs text-muted-foreground">Question {qIndex + 1}</Label>
                    <Textarea
                      value={q.question_text}
                      onChange={(e) => updateQuestion(qIndex, e.target.value)}
                      placeholder="Enter the question..."
                      className="min-h-[60px]"
                    />
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => removeQuestion(qIndex)} className="text-destructive">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <Label className="text-xs text-muted-foreground">Options (check correct answers)</Label>
              {q.options.map((opt, oIndex) => (
                <div key={oIndex} className="flex items-center gap-2">
                  <Checkbox
                    checked={opt.is_correct}
                    onCheckedChange={() => toggleCorrect(qIndex, oIndex)}
                  />
                  <Input
                    value={opt.option_text}
                    onChange={(e) => updateOption(qIndex, oIndex, e.target.value)}
                    placeholder={`Option ${String.fromCharCode(65 + oIndex)}`}
                    className="flex-1"
                  />
                  {q.options.length > 2 && (
                    <Button variant="ghost" size="sm" onClick={() => removeOption(qIndex, oIndex)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              ))}
              <Button variant="ghost" size="sm" onClick={() => addOption(qIndex)} className="text-muted-foreground">
                <Plus className="w-3 h-3 mr-1" /> Add Option
              </Button>
            </CardContent>
          </Card>
        ))}

        {questions.length === 0 && (
          <Card className="text-center py-8">
            <CardContent>
              <p className="text-muted-foreground">No questions yet. Click "Add Question" to begin.</p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
