import FirstSection from '@/components/mainPage/firstSection';
import CountDown from '@/components/mainPage/countDownSection';
import AnnouncementSection from '@/components/mainPage/announcementSection';
import ModalidadSection from '@/components/mainPage/modalitySection';
import CcemSection from '@/components/mainPage/CcemSection';
import DatesSection from '@/components/mainPage/datesSection';
import SponsorSection from '@/components/mainPage/sponsorSection';
import OrganizationSection from '@/components/mainPage/organizationSection';

export default function Main() {
  return (
    <div>
      <FirstSection />
      <CountDown />
      <AnnouncementSection />
      <ModalidadSection />
      <CcemSection />
      <DatesSection />
      <SponsorSection />
      <OrganizationSection />
    </div>
  );
}
