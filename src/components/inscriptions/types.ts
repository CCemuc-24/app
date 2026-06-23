import type { Course } from '@/actions/courses';

export interface EventsCardProps {
  id: string;
  title: string;
  module: number;
  features: Record<string, string>;
  buttonText: string;
  actionOnClick: () => void;
  clicked?: boolean;
}

export interface WeekSectionProps {
  title: string;
  subtitle: string;
  courses: Course[];
  handleSelectCourse: (course: Course) => void;
  selectedWeek: Course | null;
  weekNumber: number;
}
