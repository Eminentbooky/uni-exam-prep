import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Users, Trophy, TrendingUp, CalendarDays } from 'lucide-react';

interface StudentAttempt {
  id: string;
  user_id: string;
  course_id: string;
  score: number | null;
  correct_answers: number | null;
  total_questions: number | null;
  started_at: string;
  submitted_at: string | null;
  courses: { title: string } | null;
  profiles: { full_name: string | null; user_id: string } | null;
}

export default function StudentPerformance() {
  const { user } = useAuth();
  const [attempts, setAttempts] = useState<StudentAttempt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      // Get all courses by this instructor
      const { data: courses } = await supabase
        .from('courses')
        .select('id')
        .eq('instructor_id', user.id);

      if (!courses || courses.length === 0) {
        setLoading(false);
        return;
      }

      const courseIds = courses.map((c) => c.id);

      // Get all attempts for those courses
      const { data } = await supabase
        .from('exam_attempts')
        .select('*, courses(title)')
        .in('course_id', courseIds)
        .not('submitted_at', 'is', null)
        .order('submitted_at', { ascending: false });

      if (data) {
        // Get unique user_ids from attempts
        const userIds = [...new Set(data.map((a) => a.user_id))];

        // Get profiles for those users
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', userIds);

        const profileMap = new Map(profiles?.map((p) => [p.user_id, p]) || []);

        const enriched = data.map((a) => ({
          ...a,
          profiles: profileMap.get(a.user_id) || null,
        }));

        setAttempts(enriched as StudentAttempt[]);
      }

      setLoading(false);
    };
    load();
  }, [user]);

  const totalStudents = new Set(attempts.map((a) => a.user_id)).size;
  const avgScore = attempts.length
    ? Math.round(attempts.reduce((sum, a) => sum + (a.score ?? 0), 0) / attempts.length)
    : 0;
  const passRate = attempts.length
    ? Math.round((attempts.filter((a) => (a.score ?? 0) >= 50).length / attempts.length) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center gap-3">
          <Link to="/">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-display font-bold text-foreground">Student Performance</h1>
            <p className="text-sm text-muted-foreground">View how students are performing across your courses</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Students</p>
                <p className="text-2xl font-bold text-foreground">{totalStudents}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Trophy className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Average Score</p>
                <p className="text-2xl font-bold text-foreground">{avgScore}%</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pass Rate</p>
                <p className="text-2xl font-bold text-foreground">{passRate}%</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Attempts Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">All Student Attempts</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : attempts.length === 0 ? (
              <div className="text-center py-8">
                <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No student attempts yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Course</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Result</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attempts.map((attempt) => {
                      const score = attempt.score ?? 0;
                      const passed = score >= 50;
                      return (
                        <TableRow key={attempt.id}>
                          <TableCell className="font-medium">
                            {attempt.profiles?.full_name || 'Unknown Student'}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {attempt.courses?.title || 'Unknown'}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <CalendarDays className="w-3.5 h-3.5" />
                              {new Date(attempt.submitted_at!).toLocaleDateString()}
                            </div>
                          </TableCell>
                          <TableCell>
                            {attempt.correct_answers}/{attempt.total_questions} ({Math.round(score)}%)
                          </TableCell>
                          <TableCell>
                            <Badge variant={passed ? 'default' : 'destructive'}>
                              {passed ? 'Passed' : 'Failed'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
