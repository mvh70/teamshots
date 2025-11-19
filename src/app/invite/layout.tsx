import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';

export default async function InviteLayout({ children }: { children: React.ReactNode }) {
  // For invite routes, we'll default to English for now
  // In a production app, you might want to detect the user's locale from headers or cookies
  const locale = 'en';
  const messages = await getMessages({ locale });

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}
