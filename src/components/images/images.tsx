import courseImage1 from '@/components/images/cards/1.png';
import courseImage2 from '@/components/images/cards/2.png';
import courseImage3 from '@/components/images/cards/3.png';
import courseImage4 from '@/components/images/cards/4.png';
import courseImage5 from '@/components/images/cards/5.png';
import courseImage6 from '@/components/images/cards/6.png';
import courseImage7 from '@/components/images/cards/7.png';
import courseImage8 from '@/components/images/cards/8.png';
import { StaticImageData } from 'next/image';

const courseImagesDictionary: { [key: string]: string | StaticImageData } = {
  1: courseImage1,
  2: courseImage2,
  3: courseImage3,
  4: courseImage4,
  5: courseImage5,
  6: courseImage6,
  7: courseImage7,
  8: courseImage8,
};

export default courseImagesDictionary;
