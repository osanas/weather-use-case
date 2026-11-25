import type { Metadata } from 'next';
import { PrivacyNotice } from '@/components/PrivacyNotice';

export const metadata: Metadata = {
  title: 'Privacy notice | Weather Window',
  description: 'What Weather Window processes, who receives it and for how long.',
};

export default function PrivacyPage() {
  return <PrivacyNotice />;
}
