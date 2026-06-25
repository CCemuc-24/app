import React from 'react';
import { FileText } from 'lucide-react';

interface InfoCardProps {
  text: string;
}

const InfoCard: React.FC<InfoCardProps> = ({ text }) => {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-6 transition-colors hover:border-primary">
      <span className="flex h-12 w-12 flex-none items-center justify-center rounded-lg bg-secondary text-primary">
        <FileText className="h-6 w-6" />
      </span>
      <p className="font-display font-medium text-foreground">{text}</p>
    </div>
  );
};

export default InfoCard;
