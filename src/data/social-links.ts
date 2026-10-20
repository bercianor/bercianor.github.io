export interface SocialLink {
  label: string;
  href: string;
  image: string;
  alt: string;
  rel: string;
}

export const socialLinks: readonly SocialLink[] = [
  { label: 'GitHub', href: 'https://github.com/bercianor', image: '/static/images/social/github.svg', alt: 'Check my GitHub', rel: 'noopener noreferrer' },
  { label: 'Telegram', href: 'https://t.me/bercianor', image: '/static/images/social/telegram.svg', alt: 'Telegram', rel: 'noopener noreferrer' },
  { label: 'LinkedIn', href: 'https://es.linkedin.com/in/rubenberciano', image: '/static/images/social/linkedin.svg', alt: 'Check my LinkedIn', rel: 'noopener noreferrer' },
  { label: 'Email', href: 'mailto:ruben@bercianor.es', image: '/static/images/social/envelope.svg', alt: 'Mail Me', rel: 'noopener noreferrer' },
  { label: 'GPG', href: '/static/files/bercianor.pub.asc', image: '/static/images/social/key.svg', alt: 'Get GPG', rel: 'noopener noreferrer' },
  { label: 'PayPal', href: 'https://www.paypal.me/bercianor', image: '/static/images/social/paypal.svg', alt: 'Invitame a un café', rel: 'noopener noreferrer' },
];
