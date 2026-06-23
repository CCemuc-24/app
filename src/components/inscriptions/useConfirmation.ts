'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Course, User } from '@prisma/client';
import { confirmPurchase, getPurchaseById, sendConfirmation } from '@/actions/purchases';
import { getCourses, getCourseById } from '@/actions/courses';
import { getUserById } from '@/actions/users';

interface UseConfirmationParams {
  tokenWs: string | null;
  purchaseId: string | null;
  aborted: boolean;
}

interface UseConfirmationResult {
  confirmed: boolean;
  courses: Course[];
  user: User | null;
  isMailSent: boolean;
  errorRedirect: string | null;
  resendEmail: () => Promise<void>;
}

function errorUrl(message: string, tokenWs: string | null, purchaseId: string | null): string {
  const parts = [
    `message=${encodeURIComponent(message)}`,
    `token_ws=${encodeURIComponent(tokenWs ?? '')}`,
    `purchaseId=${encodeURIComponent(purchaseId ?? '')}`,
  ];
  return `/error?${parts.join('&')}`;
}

export function useConfirmation({ tokenWs, purchaseId, aborted }: UseConfirmationParams): UseConfirmationResult {
  const [confirmed, setConfirmed] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [isMailSent, setIsMailSent] = useState(false);
  const [errorRedirect, setErrorRedirect] = useState<string | null>(null);
  const ranRef = useRef(false);

  const sendEmail = useCallback(
    async (targetUser: User | null, loaded: Course[]) => {
      if (!purchaseId || !targetUser || targetUser.email === '') return;
      const result = await sendConfirmation({ purchaseId, email: targetUser.email });
      if (result.ok) setIsMailSent(true);
    },
    [purchaseId],
  );

  useEffect(() => {
    if (ranRef.current) return;

    if (aborted && !(tokenWs && purchaseId)) {
      ranRef.current = true;
      setErrorRedirect(errorUrl('Error en la compra', tokenWs, purchaseId));
      return;
    }

    if (!tokenWs || !purchaseId) return;
    ranRef.current = true;

    void (async () => {
      const confirmResult = await confirmPurchase(purchaseId, tokenWs);
      if (!confirmResult.ok) {
        setErrorRedirect(errorUrl(confirmResult.error, tokenWs, purchaseId));
        return;
      }
      setConfirmed(true);

      const purchaseResult = await getPurchaseById(purchaseId);
      if (!purchaseResult.ok) return;

      const loaded: Course[] = [];
      const seen = new Set<string>();
      const add = (course: Course) => {
        if (!seen.has(course.id)) {
          seen.add(course.id);
          loaded.push(course);
        }
      };

      for (const courseId of purchaseResult.data.coursesIds) {
        const courseResult = await getCourseById(courseId);
        if (courseResult.ok) add(courseResult.data);
      }

      const coursesResult = await getCourses();
      if (coursesResult.ok) {
        coursesResult.data.filter((c) => c.type === 'core').forEach(add);
      }

      const userResult = await getUserById(purchaseResult.data.userId);
      const loadedUser = userResult.ok ? userResult.data : null;

      setCourses(loaded);
      setUser(loadedUser);
      await sendEmail(loadedUser, loaded);
    })();
  }, [tokenWs, purchaseId, aborted, sendEmail]);

  const resendEmail = useCallback(async () => {
    await sendEmail(user, courses);
  }, [sendEmail, user, courses]);

  return { confirmed, courses, user, isMailSent, errorRedirect, resendEmail };
}
