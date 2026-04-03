import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BookOpen, Plus, Clock, LogOut, GraduationCap, History, Users } from 'lucide-react';

interface Course {
  id: string;
  title: string;
  description: string | null;
  time_limit_minutes: number;
  is_published: boolean;
  instructor_id: string;
  price: number;
}

export default function Dashboard() {
  const { user, profile, signOut } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const isInstructor = profile?.role === 'instructor';

  useEffect(() => {
    loadCourses();
  }, []);

  const loadCourses = async () => {
    const { data } = await supabase.from('courses').select('*').order('created_at', { ascending: false });
    setCourses(data || []);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-primary-foreground" />
            </div>
            <h1 className="text-xl font-display font-bold text-foreground">ExamForge</h1>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="gap-1">
              <GraduationCap className="w-3 h-3" />
              {profile?.role || 'student'}
            </Badge>
            <span className="text-sm text-muted-foreground hidden sm:inline">{user?.email}</span>
            {isInstructor && (
              <Link to="/students">
                <Button variant="ghost" size="sm" className="gap-1">
                  <Users className="w-4 h-4" /> Students
                </Button>
              </Link>
            )}
            {!isInstructor && (
              <Link to="/history">
                <Button variant="ghost" size="sm" className="gap-1">
                  <History className="w-4 h-4" /> History
                </Button>
              </Link>
            )}
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-display font-bold text-foreground">
              {isInstructor ? 'Your Courses' : 'Available Exams'}
            </h2>
            <p className="text-muted-foreground mt-1">
              {isInstructor ? 'Manage your courses and questions' : 'Select a course to begin your examination'}
            </p>
          </div>
          {isInstructor && (
            <Link to="/course/new">
              <Button className="gap-2">
                <Plus className="w-4 h-4" /> New Course
              </Button>
            </Link>
          )}
        </div>

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse-gentle">
                <CardHeader><div className="h-5 bg-muted rounded w-2/3" /></CardHeader>
                <CardContent><div className="h-4 bg-muted rounded w-1/2" /></CardContent>
              </Card>
            ))}
          </div>
        ) : courses.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                {isInstructor ? 'No courses yet' : 'No exams available'}
              </h3>
              <p className="text-muted-foreground mb-4">
                {isInstructor ? 'Create your first course to get started.' : 'Check back later for available exams.'}
              </p>
              {isInstructor && (
                <Link to="/course/new">
                  <Button>Create Course</Button>
                </Link>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {courses.map((course) => (
              <Link
                key={course.id}
                to={isInstructor ? `/course/${course.id}/manage` : `/exam/${course.id}`}
              >
                <Card className="h-full hover:shadow-md transition-shadow cursor-pointer group">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-lg group-hover:text-primary transition-colors">
                        {course.title}
                      </CardTitle>
                      {isInstructor && (
                        <Badge variant={course.is_published ? 'default' : 'secondary'}>
                          {course.is_published ? 'Published' : 'Draft'}
                        </Badge>
                      )}
                    </div>
                    {course.description && (
                      <CardDescription className="line-clamp-2">{course.description}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Clock className="w-4 h-4" />
                        {course.time_limit_minutes} minutes
                      </div>
                      {!isInstructor && (
                        <Badge variant={(course as any).price > 0 ? 'default' : 'secondary'}>
                          {(course as any).price > 0 ? `₦${(course as any).price.toLocaleString()}` : 'Free'}
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
