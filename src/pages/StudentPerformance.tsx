import { useEffect, useState, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ArrowLeft, Users, Trophy, TrendingUp, CalendarDays, Filter, Download, User as UserIcon, Search, ChevronUp, ChevronDown, MessageSquare, MessageSquarePlus } from 'lucide-react';
import { Bar, BarChart, XAxis, YAxis, CartesianGrid, Line, LineChart } from 'recharts';
import AttemptFeedbackDialog from '@/components/AttemptFeedbackDialog';

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
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [sortColumn, setSortColumn] = useState<'date' | 'score' | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [feedbackIds, setFeedbackIds] = useState<Set<string>>(new Set());
  const [feedbackTarget, setFeedbackTarget] = useState<{ id: string; name: string } | null>(null);

  const handleSort = (column: 'date' | 'score') => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  const SortIcon = ({ column }: { column: 'date' | 'score' }) => {
    if (sortColumn !== column) return <ChevronUp className="w-4 h-4 text-muted-foreground opacity-30" />;
    return sortDirection === 'asc'
      ? <ChevronUp className="w-4 h-4 text-primary" />
      : <ChevronDown className="w-4 h-4 text-primary" />;
  };

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

        const attemptIds = data.map((a) => a.id);
        if (attemptIds.length > 0) {
          const { data: fb } = await supabase
            .from('attempt_feedback')
            .select('attempt_id')
            .eq('instructor_id', user.id)
            .in('attempt_id', attemptIds);
          if (fb) setFeedbackIds(new Set(fb.map((f) => f.attempt_id)));
        }
      }

      setLoading(false);
    };
    load();
  }, [user]);

  const filtered = useMemo(() => {
    let byCourse = selectedCourse === 'all' ? attempts : attempts.filter((a) => a.course_id === selectedCourse);
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      byCourse = byCourse.filter((a) => (a.profiles?.full_name || 'Unknown Student').toLowerCase().includes(q));
    }
    if (sortColumn) {
      byCourse = [...byCourse].sort((a, b) => {
        let comparison = 0;
        if (sortColumn === 'date') {
          const dateA = new Date(a.submitted_at || 0).getTime();
          const dateB = new Date(b.submitted_at || 0).getTime();
          comparison = dateA - dateB;
        } else if (sortColumn === 'score') {
          comparison = (a.score ?? 0) - (b.score ?? 0);
        }
        return sortDirection === 'asc' ? comparison : -comparison;
      });
    }
    return byCourse;
  }, [attempts, selectedCourse, searchQuery, sortColumn, sortDirection]);

  const totalStudents = new Set(filtered.map((a) => a.user_id)).size;
  const avgScore = filtered.length
    ? Math.round(filtered.reduce((sum, a) => sum + (a.score ?? 0), 0) / filtered.length)
    : 0;
  const passRate = filtered.length
    ? Math.round((filtered.filter((a) => (a.score ?? 0) >= 50).length / filtered.length) * 100)
    : 0;

  const scoreDistribution = useMemo(() => {
    const buckets = [
      { range: '0-20%', min: 0, max: 20, count: 0 },
      { range: '21-40%', min: 21, max: 40, count: 0 },
      { range: '41-60%', min: 41, max: 60, count: 0 },
      { range: '61-80%', min: 61, max: 80, count: 0 },
      { range: '81-100%', min: 81, max: 100, count: 0 },
    ];
    filtered.forEach((a) => {
      const s = Math.round(a.score ?? 0);
      const bucket = buckets.find((b) => s >= b.min && s <= b.max);
      if (bucket) bucket.count++;
    });
    return buckets;
  }, [filtered]);

  const chartConfig: ChartConfig = {
    count: { label: 'Students', color: 'hsl(var(--primary))' },
    score: { label: 'Score', color: 'hsl(var(--primary))' },
  };

  const studentDetail = useMemo(() => {
    if (!selectedStudent) return null;
    const studentAttempts = attempts
      .filter((a) => a.user_id === selectedStudent)
      .sort((x, y) => new Date(x.submitted_at!).getTime() - new Date(y.submitted_at!).getTime());
    if (studentAttempts.length === 0) return null;
    const name = studentAttempts[0].profiles?.full_name || 'Unknown Student';
    const scores = studentAttempts.map((a) => a.score ?? 0);
    const avg = Math.round(scores.reduce((s, v) => s + v, 0) / scores.length);
    const best = Math.round(Math.max(...scores));
    const trend = studentAttempts.map((a, i) => ({
      label: `#${i + 1}`,
      date: a.submitted_at ? new Date(a.submitted_at).toLocaleDateString() : '',
      score: Math.round(a.score ?? 0),
      course: a.courses?.title || 'Unknown',
    }));
    return { name, attempts: studentAttempts, avg, best, trend, total: studentAttempts.length };
  }, [selectedStudent, attempts]);

  const exportCsv = useCallback(() => {
    if (filtered.length === 0) return;
    const header = ['Student', 'Course', 'Date', 'Correct', 'Total', 'Score (%)'];
    const rows = filtered.map((a) => [
      a.profiles?.full_name || 'Unknown Student',
      a.courses?.title || 'Unknown',
      a.submitted_at ? new Date(a.submitted_at).toLocaleDateString() : '',
      a.correct_answers ?? '',
      a.total_questions ?? '',
      a.score != null ? Math.round(a.score) : '',
    ]);
    const csv = [header, ...rows].map((r) => r.map((v) => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `student-performance${selectedCourse !== 'all' ? `-${courses.find(c => c.id === selectedCourse)?.title}` : ''}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filtered, selectedCourse, courses]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center gap-3">
          <Link to="/">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-display font-bold text-foreground">Student Performance</h1>
            <p className="text-sm text-muted-foreground">View how students are performing across your courses</p>
          </div>
          {filtered.length > 0 && (
            <Button variant="outline" size="sm" onClick={exportCsv} className="gap-1.5">
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Export CSV</span>
            </Button>
          )}
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-6">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          {courses.length > 1 && (
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <Select value={selectedCourse} onValueChange={setSelectedCourse}>
                <SelectTrigger className="w-full sm:w-[240px]">
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
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search students by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>

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

        {/* Score Distribution Chart */}
        {filtered.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Score Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[250px] w-full">
                <BarChart data={scoreDistribution} accessibilityLayer>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="range" tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="count" fill="var(--color-count)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        )}

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
                      <TableHead
                        className="cursor-pointer hover:text-foreground transition-colors"
                        onClick={() => handleSort('date')}
                      >
                        <div className="flex items-center gap-1">
                          Date
                          <SortIcon column="date" />
                        </div>
                      </TableHead>
                      <TableHead
                        className="cursor-pointer hover:text-foreground transition-colors"
                        onClick={() => handleSort('score')}
                      >
                        <div className="flex items-center gap-1">
                          Score
                          <SortIcon column="score" />
                        </div>
                      </TableHead>
                      <TableHead>Result</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((attempt) => {
                      const score = attempt.score ?? 0;
                      const passed = score >= 50;
                      return (
                        <TableRow
                          key={attempt.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => setSelectedStudent(attempt.user_id)}
                        >
                          <TableCell className="font-medium text-primary hover:underline">
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

      <Dialog open={!!selectedStudent} onOpenChange={(open) => !open && setSelectedStudent(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {studentDetail && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <UserIcon className="w-5 h-5 text-primary" />
                  {studentDetail.name}
                </DialogTitle>
                <DialogDescription>Progress over time across {studentDetail.total} attempt{studentDetail.total !== 1 ? 's' : ''}</DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-3 gap-3">
                <Card>
                  <CardContent className="p-3">
                    <p className="text-xs text-muted-foreground">Attempts</p>
                    <p className="text-xl font-bold text-foreground">{studentDetail.total}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3">
                    <p className="text-xs text-muted-foreground">Average</p>
                    <p className="text-xl font-bold text-foreground">{studentDetail.avg}%</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3">
                    <p className="text-xs text-muted-foreground">Best</p>
                    <p className="text-xl font-bold text-foreground">{studentDetail.best}%</p>
                  </CardContent>
                </Card>
              </div>

              {studentDetail.trend.length > 1 && (
                <div>
                  <p className="text-sm font-medium mb-2 text-foreground">Score Trend</p>
                  <ChartContainer config={chartConfig} className="h-[200px] w-full">
                    <LineChart data={studentDetail.trend} accessibilityLayer margin={{ left: 4, right: 8, top: 8 }}>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
                      <YAxis domain={[0, 100]} tickLine={false} axisLine={false} fontSize={12} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Line type="monotone" dataKey="score" stroke="var(--color-score)" strokeWidth={2} dot={{ r: 4 }} />
                    </LineChart>
                  </ChartContainer>
                </div>
              )}

              <div>
                <p className="text-sm font-medium mb-2 text-foreground">Attempt History</p>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Course</TableHead>
                        <TableHead>Score</TableHead>
                        <TableHead>Result</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[...studentDetail.attempts].reverse().map((a) => {
                        const s = Math.round(a.score ?? 0);
                        const passed = s >= 50;
                        return (
                          <TableRow key={a.id}>
                            <TableCell className="text-muted-foreground text-sm">
                              {a.submitted_at ? new Date(a.submitted_at).toLocaleDateString() : ''}
                            </TableCell>
                            <TableCell className="text-sm">{a.courses?.title || 'Unknown'}</TableCell>
                            <TableCell className="text-sm">
                              {a.correct_answers}/{a.total_questions} ({s}%)
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
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
