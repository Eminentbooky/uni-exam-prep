import { useEffect, useState, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Users, Trophy, TrendingUp, CalendarDays, Filter, Download } from 'lucide-react';

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

interface CourseOption {
  id: string;
  title: string;
}

export default function StudentPerformance() {
  const { user } = useAuth();
  const [attempts, setAttempts] = useState<StudentAttempt[]>([]);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data: coursesData } = await supabase
        .from('courses')
        .select('id, title')
        .eq('instructor_id', user.id);

      if (!coursesData || coursesData.length === 0) {
        setLoading(false);
        return;
      }

      setCourses(coursesData);
      const courseIds = coursesData.map((c) => c.id);

      const { data } = await supabase
        .from('exam_attempts')
        .select('*, courses(title)')
        .in('course_id', courseIds)
        .not('submitted_at', 'is', null)
        .order('submitted_at', { ascending: false });

      if (data) {
        const userIds = [...new Set(data.map((a) => a.user_id))];
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

  const filtered = useMemo(
    () => selectedCourse === 'all' ? attempts : attempts.filter((a) => a.course_id === selectedCourse),
    [attempts, selectedCourse]
  );

  const totalStudents = new Set(filtered.map((a) => a.user_id)).size;
  const avgScore = filtered.length
    ? Math.round(filtered.reduce((sum, a) => sum + (a.score ?? 0), 0) / filtered.length)
    : 0;
  const passRate = filtered.length
    ? Math.round((filtered.filter((a) => (a.score ?? 0) >= 50).length / filtered.length) * 100)
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
        {/* Course Filter */}
        {courses.length > 1 && (
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <Select value={selectedCourse} onValueChange={setSelectedCourse}>
              <SelectTrigger className="w-[240px]">
                <SelectValue placeholder="Filter by course" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Courses</SelectItem>
                {courses.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

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
            <CardTitle className="text-lg">
              {selectedCourse === 'all' ? 'All Student Attempts' : `Attempts — ${courses.find(c => c.id === selectedCourse)?.title}`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filtered.length === 0 ? (
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
                    {filtered.map((attempt) => {
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
