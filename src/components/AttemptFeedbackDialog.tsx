import { useEffect, useState } from 'react';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { MessageSquare, Trash2 } from 'lucide-react';

const feedbackSchema = z
  .string()
  .trim()
  .nonempty({ message: 'Feedback cannot be empty' })
  .max(2000, { message: 'Feedback must be 2000 characters or less' });

interface AttemptFeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  attemptId: string;
  studentName: string;
  onSaved?: (attemptId: string, hasFeedback: boolean) => void;
}

export default function AttemptFeedbackDialog({
  open,
  onOpenChange,
  attemptId,
  studentName,
  onSaved,
}: AttemptFeedbackDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [text, setText] = useState('');
  const [existingId, setExistingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    setLoading(true);
    setText('');
    setExistingId(null);
    supabase
      .from('attempt_feedback')
      .select('id, feedback_text')
      .eq('attempt_id', attemptId)
      .eq('instructor_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setExistingId(data.id);
          setText(data.feedback_text);
        }
        setLoading(false);
      });
  }, [open, user, attemptId]);

  const handleSave = async () => {
    if (!user) return;
    const result = feedbackSchema.safeParse(text);
    if (!result.success) {
      toast({
        title: 'Invalid feedback',
        description: result.error.issues[0].message,
        variant: 'destructive',
      });
      return;
    }
    setSaving(true);
    const payload = {
      attempt_id: attemptId,
      instructor_id: user.id,
      feedback_text: result.data,
    };
    const { error } = existingId
      ? await supabase.from('attempt_feedback').update({ feedback_text: result.data }).eq('id', existingId)
      : await supabase.from('attempt_feedback').insert(payload);
    setSaving(false);
    if (error) {
      toast({ title: 'Could not save feedback', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Feedback saved' });
    onSaved?.(attemptId, true);
    onOpenChange(false);
  };

  const handleDelete = async () => {
    if (!existingId) return;
    setSaving(true);
    const { error } = await supabase.from('attempt_feedback').delete().eq('id', existingId);
    setSaving(false);
    if (error) {
      toast({ title: 'Could not delete', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Feedback removed' });
    onSaved?.(attemptId, false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" />
            Feedback for {studentName}
          </DialogTitle>
          <DialogDescription>
            Share notes, encouragement, or improvement areas for this attempt. Visible to the student.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-6">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Write your feedback here..."
            rows={6}
            maxLength={2000}
          />
        )}
        <p className="text-xs text-muted-foreground text-right">{text.length}/2000</p>

        <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-between gap-2">
          <div>
            {existingId && (
              <Button variant="ghost" size="sm" onClick={handleDelete} disabled={saving} className="text-destructive hover:text-destructive">
                <Trash2 className="w-4 h-4 mr-1" />
                Delete
              </Button>
            )}
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || loading}>
              {saving ? 'Saving...' : existingId ? 'Update' : 'Save'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
