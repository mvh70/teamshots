import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { routing } from '@/i18n/routing';
import { getBrand } from '@/config/brand';
import { getBaseUrl } from '@/lib/url';
import {
  ArticleJsonLd,
  FaqJsonLd,
  AuthorBox,
  TldrSection,
  Breadcrumb,
} from '@/components/blog';

type Props = {
  params: Promise<{ locale: string }>;
};

const getContent = (locale: string, brandName: string) => {
  if (locale === 'es') {
    return {
      title: 'Generadores de Headshots AI Gratuitos vs Pagados 2026: Comparación Honesta',
      description: `Compara generadores de headshots AI gratuitos vs pagados en 2026. Ve ejemplos reales, diferencias de calidad y cuándo actualizar para resultados profesionales.`,
      breadcrumb: 'Headshots AI Gratuitos vs Pagados',
      tldr: [
        '<strong>Para uso casual:</strong> Las herramientas gratuitas funcionan bien para avatares de redes sociales o proyectos personales donde la calidad no es crítica.',
        '<strong>Para uso profesional:</strong> Las herramientas pagadas valen cada centavo. La diferencia en calidad es inmediatamente visible e impacta cómo te perciben las personas.',
        '<strong>Cálculo de ROI:</strong> Un headshot AI de $20 vs un fotógrafo de $200 vs cero clientes porque tu foto de LinkedIn grita "no me tomo esto en serio".'
      ],
      sections: {
        realCostFree: {
          title: 'El Costo Real de lo "Gratis"',
          p1: 'Seamos honestos: buscaste "generador de headshot AI gratis" porque ¿quién quiere pagar por algo si no tiene que hacerlo? Lo respeto. Pero aquí está lo que "gratis" a menudo significa realmente:',
          boxTitle: 'Los Costos Ocultos de las Herramientas Gratuitas',
          items: [
            '💰 <strong>Marcas de agua:</strong> Ese logotipo pegado en tu cara no es exactamente material para LinkedIn',
            '📉 <strong>Baja resolución:</strong> 512x512 píxeles se ve bien como miniatura, pero ¿hacer zoom? Ciudad de píxeles.',
            '🎨 <strong>Opciones limitadas:</strong> Quizás 2-3 fondos, una expresión, tómalo o déjalo',
            '⏰ <strong>Tu tiempo:</strong> Horas gastadas probando diferentes herramientas gratuitas, decepcionándote, intentando de nuevo',
            '📊 <strong>Tus datos:</strong> Las herramientas gratuitas monetizan de alguna manera. Generalmente son tus fotos entrenando sus modelos.'
          ],
          p2: 'La matemática rara vez funciona a favor de lo "gratis". Si pasas 3 horas probando diferentes herramientas gratuitas y tu tiempo vale $30/hora, ya has gastado $90. Las herramientas pagadas te habrían dado mejores resultados en 10 minutos.'
        },
        comparison: {
          title: 'Comparación de Generadores de Headshots AI Gratuitos vs Pagados 2026',
          table: {
            headers: ['Característica', 'Herramientas Gratuitas', 'Herramientas Pagadas'],
            rows: [
              ['Calidad de Imagen', 'Baja-media (a menudo caricaturesca)', 'Alta (realismo calidad estudio)'],
              ['Resolución', '512x512 - 1024x1024', '1024x1024 - 4K+'],
              ['Marcas de Agua', 'Generalmente sí', 'Sin marcas de agua'],
              ['Opciones de Fondo', '2-5 opciones básicas', 'Ilimitadas / personalizables'],
              ['Estilos de Ropa', 'Limitados o ninguno', 'Múltiples opciones profesionales'],
              ['Derechos Comerciales', 'A menudo restringidos', 'Propiedad total incluida'],
              ['Reintentos/Variaciones', '1-2 por día', 'Múltiples incluidos'],
              ['Soporte', 'Ninguno / foros comunitarios', 'Email / garantía de satisfacción']
            ]
          }
        },
        freeToolsStrengths: {
          title: 'Cuándo las Herramientas Gratuitas Realmente Tienen Sentido',
          p1: 'No estoy aquí para criticar las herramientas gratuitas. Tienen su lugar:',
          boxTitle: '✅ Buenos Casos de Uso para Headshots AI Gratuitos',
          items: [
            '• Avatares para juegos o fotos de perfil de Discord',
            '• Marcador temporal mientras obtienes fotos adecuadas',
            '• Cuentas de redes sociales personales donde la percepción profesional no importa',
            '• Probar cómo se ven los headshots AI antes de comprometerse con pagos',
            '• Experimentos divertidos o probar diferentes looks'
          ],
          p2: 'Si una versión caricaturesca de ti mismo con una marca de agua en la esquina no te molesta para tu caso de uso, las herramientas gratuitas están bien. Sin juicios.'
        },
        whenToInvest: {
          title: 'Cuándo los Headshots AI Pagados Valen Cada Centavo',
          p1: 'Aquí es donde el cálculo del ROI se pone interesante:',
          items: [
            { title: 'Perfil de LinkedIn', text: 'Los perfiles con fotos profesionales obtienen 21x más vistas y 36x más mensajes. Si buscas trabajo o construyes tu red, esto es fundamental.' },
            { title: 'Página "Sobre Nosotros" de la Empresa', text: 'Cuando un cliente potencial o inversor visita tu sitio, las fotos de tu equipo son una señal de confianza. Los headshots de dibujos animados dicen "recortamos esquinas".' },
            { title: 'Materiales para Clientes', text: 'Propuestas, presentaciones, firmas de correo. Cada punto de contacto con clientes debe comunicar profesionalismo.' },
            { title: 'Conferencias o Podcasts', text: 'Los organizadores de conferencias y anfitriones de podcasts a menudo presentan tu headshot. Dales algo que valga la pena presentar.' },
            { title: 'Consistencia de Equipo', text: 'Si obtienes headshots para un equipo, la consistencia importa. Las herramientas gratuitas no pueden entregar estilos coincidentes en varias personas.' }
          ]
        },
        roi: {
          title: 'La Matemática del ROI (Sí, Hicimos los Cálculos)',
          p1: 'Desglosemos lo que realmente cuestan tus opciones de headshot:',
          table: {
            headers: ['Opción', 'Costo Directo', 'Costo de Tiempo', 'Total (@ $40/h)'],
            rows: [
              ['Herramientas AI gratuitas (prueba y error)', '$0', '2-3 horas', '$80-120'],
              [`Herramienta AI Pagada (${brandName})`, '$19.99', '5-10 min', '~$27'],
              ['Fotógrafo profesional', '$200-500', '2-4 horas', '$280-660']
            ]
          },
          p2: 'Giro inesperado: "gratis" es a menudo la opción más cara cuando cuentas tu tiempo.'
        },
        whatToLookFor: {
          title: 'Si Pagas: Qué Buscar',
          p1: 'No todas las herramientas de headshots AI pagadas son iguales. Aquí está tu lista de verificación:',
          mustHaves: {
            title: 'Imprescindibles',
            items: ['✓ Alta resolución (1024x1024 mínimo)', '✓ Sin marcas de agua en las salidas', '✓ Múltiples opciones de estilo/fondo', '✓ Resultados de aspecto natural (no caricaturescos)', '✓ Derechos de uso comercial incluidos']
          },
          niceToHaves: {
            title: 'Deseables',
            items: ['✓ Múltiples variaciones por generación', '✓ Reintentos gratuitos para perfeccionar resultados', '✓ Entrega rápida (menos de una hora)', '✓ Opciones de precios para equipos/volumen', '✓ Garantía de satisfacción']
          }
        },
        recommendations: {
          title: 'Nuestras Recomendaciones Honestas',
          items: [
            { title: `Mejor para Equipos: ${brandName}`, desc: 'Generación en 60 segundos, estilos coincidentes en miembros del equipo, desde $49 para equipos. Divulgación completa: sí, este es nuestro producto. Lo construimos porque otras herramientas no podían entregar consistencia para equipos.', bestFor: 'Startups, equipos remotos, sitios web de empresas' },
            { title: 'Mejor Opción Gratuita: BetterPic', desc: 'Ofrece resultados realistas sin marcas de agua en el nivel gratuito. Procesamiento rápido en minutos. Características limitadas comparadas con las pagadas, pero bueno para probar.', bestFor: 'Uso casual, probar headshots AI' },
            { title: 'Mejor para Individuos: HeadshotPro', desc: 'Headshots individuales de alta calidad desde $29. Tarda más de 2 horas pero entrega resultados profesionales. Buena variedad de estilos.', bestFor: 'Profesionales individuales, buscadores de empleo' },
            { title: 'Mejor Opción Económica: Try It On AI', desc: 'Comenzando en $15 con entrega en 30 minutos. La calidad es decente, no excepcional. Buen punto medio entre gratuito y premium.', bestFor: 'Presupuestos ajustados, uso profesional casual' }
          ]
        },
        bottomLine: {
          title: 'La Conclusión',
          p1: 'Los generadores de headshots AI gratuitos son como la comida rápida: convenientes, disponibles en todas partes y bien en un apuro. Pero no la servirías en una cena de negocios importante.',
          p2: 'Si tu headshot te representa en cualquier capacidad profesional (LinkedIn, sitio web de la empresa, propuestas a clientes), vale la pena gastar $20-50 para hacerlo bien. El ROI es casi siempre positivo.',
          p3: '¿Si solo necesitas un avatar para tu perfil de juegos? Las herramientas gratuitas son geniales. Sin vergüenza.',
          boxText: '<strong>La verdadera pregunta no es "¿gratis o pagado?"</strong> Es "¿cuánto vale esta foto para mi imagen profesional?" Si la respuesta es "mucho", invierte en consecuencia.'
        }
      },
      faqTitle: 'Preguntas Frecuentes',
      cta: {
        title: '¿Listo para ver la diferencia que hace la calidad?',
        description: `Prueba ${brandName} gratis y compara por ti mismo. Sin marcas de agua, sin compromisos.`,
        button: `Prueba ${brandName} Gratis →`
      },
      author: {
        title: `Fundador, ${brandName}`,
        bio: `Matthieu van Haperen es el fundador de ${brandName} y un ex venture builder con más de 6 años de experiencia en startups. Escribe sobre herramientas de IA, productividad y construcción en público.`
      }
    };
  }

  // English
  return {
    title: 'Free vs Paid AI Headshot Generators 2026: Honest Comparison',
    description: `Compare free AI headshot generators vs paid in 2026. See real examples, quality differences, and when to upgrade for professional results.`,
    breadcrumb: 'Free vs Paid AI Headshots',
    tldr: [
      '<strong>For casual use:</strong> Free tools work fine for social media avatars or personal projects where quality isn\'t critical.',
      '<strong>For professional use:</strong> Paid tools are worth every cent. The difference in quality is immediately visible and impacts how people perceive you.',
      '<strong>ROI calculation:</strong> A $20 AI headshot vs. a $200 photographer vs. zero clients because your LinkedIn photo screams "I don\'t take this seriously."'
    ],
    sections: {
      realCostFree: {
        title: 'The Real Cost of "Free"',
        p1: 'Let\'s be honest: you searched for "free AI headshot generator" because who wants to pay for something if they don\'t have to? I respect that. But here\'s what "free" often actually means:',
        boxTitle: 'The Hidden Costs of Free Tools',
        items: [
          '💰 <strong>Watermarks:</strong> That logo plastered across your face isn\'t exactly LinkedIn material',
          '📉 <strong>Low resolution:</strong> 512x512 pixels looks fine as a thumbnail, but zoom in? Pixel city.',
          '🎨 <strong>Limited options:</strong> Maybe 2-3 backgrounds, one expression, take it or leave it',
          '⏰ <strong>Your time:</strong> Hours spent trying different free tools, getting disappointed, trying again',
          '📊 <strong>Your data:</strong> Free tools monetize somehow. Usually it\'s your photos training their models.'
        ],
        p2: 'The math rarely works in favor of "free." If you spend 3 hours trying different free tools and your time is worth $30/hour, you\'ve already spent $90. Paid tools would have given you better results in 10 minutes.'
      },
      comparison: {
        title: 'Free vs Paid AI Headshot Generator Comparison 2026',
        table: {
          headers: ['Feature', 'Free Tools', 'Paid Tools'],
          rows: [
            ['Image Quality', 'Low-medium (often cartoonish)', 'High (studio-quality realism)'],
            ['Resolution', '512x512 - 1024x1024', '1024x1024 - 4K+'],
            ['Watermarks', 'Usually yes', 'No watermarks'],
            ['Background Options', '2-5 basic options', 'Unlimited / customizable'],
            ['Clothing Styles', 'Limited or none', 'Multiple professional options'],
            ['Commercial Rights', 'Often restricted', 'Full ownership included'],
            ['Retries/Variations', '1-2 per day', 'Multiple included'],
            ['Support', 'None / community forums', 'Email / satisfaction guarantee']
          ]
        }
      },
      freeToolsStrengths: {
        title: 'When Free Tools Actually Make Sense',
        p1: 'I\'m not here to dunk on free tools. They have their place:',
        boxTitle: '✅ Good Use Cases for Free AI Headshots',
        items: [
          '• Gaming avatars or Discord profile pictures',
          '• Temporary placeholder while you get proper photos',
          '• Personal social media accounts where professional perception doesn\'t matter',
          '• Testing what AI headshots look like before committing to paid',
          '• Fun experiments or trying different looks'
        ],
        p2: 'If a cartoon-ish version of yourself with a watermark in the corner doesn\'t bother you for your use case, free tools are fine. No judgment.'
      },
      whenToInvest: {
        title: 'When Paid AI Headshots Are Worth Every Cent',
        p1: 'Here\'s where the ROI calculation gets interesting:',
        items: [
          { title: 'LinkedIn Profile', text: 'Profiles with professional photos get 21x more views and 36x more messages. If you\'re job hunting or building your network, this is table stakes.' },
          { title: 'Company "About Us" Page', text: 'When a potential client or investor visits your site, your team photos are a trust signal. Cartoon headshots say "we cut corners."' },
          { title: 'Client-Facing Materials', text: 'Proposals, pitch decks, email signatures. Every touchpoint with clients should communicate professionalism.' },
          { title: 'Speaking Engagements or Podcasts', text: 'Conference organizers and podcast hosts often feature your headshot. Give them something worth featuring.' },
          { title: 'Team Consistency', text: 'If you\'re getting headshots for a team, consistency matters. Free tools can\'t deliver matching styles across multiple people.' }
        ]
      },
      roi: {
        title: 'The ROI Math (Yes, We Did the Math)',
        p1: 'Let\'s break down what your headshot options actually cost:',
        table: {
          headers: ['Option', 'Direct Cost', 'Time Cost', 'Total (@ $40/hr)'],
          rows: [
            ['Free AI tools (trial and error)', '$0', '2-3 hours', '$80-120'],
            [`Paid AI tool (${brandName})`, '$19.99', '5-10 min', '~$27'],
            ['Professional photographer', '$200-500', '2-4 hours', '$280-660']
          ]
        },
        p2: 'Plot twist: "free" is often the most expensive option when you count your time.'
      },
      whatToLookFor: {
        title: 'If You Go Paid: What to Look For',
        p1: 'Not all paid AI headshot tools are created equal. Here\'s your checklist:',
        mustHaves: {
          title: 'Must-Haves',
          items: ['✓ High resolution (1024x1024 minimum)', '✓ No watermarks on outputs', '✓ Multiple style/background options', '✓ Natural-looking results (not cartoonish)', '✓ Commercial use rights included']
        },
        niceToHaves: {
          title: 'Nice-to-Haves',
          items: ['✓ Multiple variations per generation', '✓ Free retries to perfect results', '✓ Fast turnaround (under an hour)', '✓ Team/bulk pricing options', '✓ Satisfaction guarantee']
        }
      },
      recommendations: {
        title: 'Our Honest Recommendations',
        items: [
          { title: `Best for Teams: ${brandName}`, desc: '60-second generation, matching styles across team members, starting at $49 for teams. Full disclosure: yes, this is our product. We built it because other tools couldn\'t deliver consistency for teams.', bestFor: 'Startups, remote teams, company websites' },
          { title: 'Best Free Option: BetterPic', desc: 'Offers realistic results without watermarks in free tier. Quick processing in minutes. Limited features compared to paid, but good for testing.', bestFor: 'Casual use, testing AI headshots' },
          { title: 'Best for Individuals: HeadshotPro', desc: 'High-quality individual headshots starting at $29. Takes 2+ hours but delivers professional results. Good variety of styles.', bestFor: 'Individual professionals, job seekers' },
          { title: 'Best Budget Option: Try It On AI', desc: 'Starting at $15 with 30-minute turnaround. Quality is decent, not exceptional. Good middle ground between free and premium.', bestFor: 'Tight budgets, casual professional use' }
        ]
      },
      bottomLine: {
        title: 'The Bottom Line',
        p1: 'Free AI headshot generators are like fast food: convenient, available everywhere, and fine in a pinch. But you wouldn\'t serve it at an important business dinner.',
        p2: 'If your headshot represents you in any professional capacity (LinkedIn, company website, client proposals), it\'s worth spending $20-50 to get it right. The ROI is almost always positive.',
        p3: 'If you just need an avatar for your gaming profile? Free tools are great. No shame.',
        boxText: '<strong>The real question isn\'t "free or paid?"</strong> It\'s "what is this photo worth to my professional image?" If the answer is "a lot," invest accordingly.'
      }
    },
    faqTitle: 'Frequently Asked Questions',
    cta: {
      title: 'Ready to see the difference quality makes?',
      description: `Try ${brandName} free and compare for yourself. No watermarks, no commitments.`,
      button: `Try ${brandName} Free →`
    },
    author: {
      title: `Founder, ${brandName}`,
      bio: `Matthieu van Haperen is the founder of ${brandName} and a former venture builder with 6+ years of experience in startups. He writes about AI tools, productivity, and building in public.`
    }
  };
};

const getFaqItems = (locale: string, brandName: string) => {
  if (locale === 'es') {
    return [
      {
        question: '¿Son buenos los generadores de headshots AI gratuitos?',
        answer: 'Las herramientas gratuitas pueden funcionar para uso casual (redes sociales, proyectos personales), pero típicamente tienen limitaciones: marcas de agua, menor resolución, menos opciones de estilo y resultados menos realistas. Para uso profesional como LinkedIn o sitios web de empresas, las herramientas pagadas ofrecen una calidad notablemente mejor.',
      },
      {
        question: '¿Cuál es la mayor diferencia entre headshots AI gratuitos y pagados?',
        answer: 'Realismo. Las herramientas gratuitas a menudo producen resultados caricaturescos o demasiado filtrados porque usan modelos de IA más simples. Las herramientas pagadas invierten en mejor tecnología que produce textura de piel de aspecto natural, iluminación realista y proporciones adecuadas.',
      },
      {
        question: '¿Vale la pena pagar por headshots AI?',
        answer: `Si usas la foto profesionalmente (LinkedIn, sitio web de la empresa, materiales para clientes), sí. Los $15-50 que gastas en headshots AI de calidad se pagan solos en mejores primeras impresiones. Considéralo: un fotógrafo tradicional cuesta $200-500. ${brandName} comienza en $19.99.`,
      },
      {
        question: '¿Puedo usar headshots AI gratuitos para LinkedIn?',
        answer: 'Puedes, pero procede con precaución. Muchas herramientas gratuitas producen resultados que se ven obviamente artificiales, lo que puede dañar tu credibilidad profesional. Si vas por la ruta gratuita, sé muy selectivo sobre qué resultado usas.',
      },
    ];
  }

  // English
  return [
    {
      question: 'Are free AI headshot generators any good?',
      answer: 'Free tools can work for casual use (social media, personal projects), but they typically have limitations: watermarks, lower resolution, fewer style options, and less realistic results. For professional use like LinkedIn or company websites, paid tools deliver noticeably better quality.',
    },
    {
      question: 'What\'s the biggest difference between free and paid AI headshots?',
      answer: 'Realism. Free tools often produce cartoon-like or over-filtered results because they use simpler AI models. Paid tools invest in better technology that produces natural-looking skin texture, realistic lighting, and proper proportions.',
    },
    {
      question: 'Is it worth paying for AI headshots?',
      answer: `If you're using the photo professionally (LinkedIn, company website, client-facing materials), yes. The $15-50 you spend on quality AI headshots pays for itself in better first impressions. Consider it: a traditional photographer costs $200-500. ${brandName} starts at $19.99.`,
    },
    {
      question: 'Can I use free AI headshots for LinkedIn?',
      answer: 'You can, but proceed with caution. Many free tools produce results that look obviously artificial, which can hurt your professional credibility. If you go the free route, be very selective about which output you use.',
    },
  ];
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const headersList = await headers();
  const brandConfig = getBrand(headersList);
  const content = getContent(locale, brandConfig.name);

  return {
    title: content.title,
    description: content.description,
    openGraph: {
      title: content.title,
      description: content.description,
      type: 'article',
      publishedTime: '2025-11-28',
      authors: ['Matthieu van Haperen'],
    },
    alternates: {
      canonical: '/blog/free-vs-paid-ai-headshots',
      languages: {
        en: '/blog/free-vs-paid-ai-headshots',
        es: '/es/blog/free-vs-paid-ai-headshots',
      },
    },
  };
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function FreeVsPaidHeadshotsPage({ params }: Props) {
  const { locale } = await params;
  const headersList = await headers();
  const brandConfig = getBrand(headersList);
  const baseUrl = getBaseUrl(headersList);
  
  const content = getContent(locale, brandConfig.name);
  const faqItems = getFaqItems(locale, brandConfig.name);

  return (
    <>
      <ArticleJsonLd
        headline={content.title}
        description={content.description}
        authorName="Matthieu van Haperen"
        authorUrl="https://linkedin.com/in/yourprofile"
        authorJobTitle={`Founder, ${brandConfig.name}`}
        publisherName={brandConfig.name}
        publisherUrl={baseUrl}
        datePublished="2025-11-28"
        url={`${baseUrl}${locale === 'es' ? '/es' : ''}/blog/free-vs-paid-ai-headshots`}
      />
      <FaqJsonLd items={faqItems} />

      <article>
        <Breadcrumb
          items={[
            { label: locale === 'es' ? 'Inicio' : 'Home', href: '/' },
            { label: 'Blog', href: '/blog' },
            { label: content.breadcrumb },
          ]}
        />

        <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
          {content.title}
        </h1>

        {/* Author byline */}
        <div className="flex items-center gap-3 mb-8 text-sm text-gray-600">
          <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-medium">
            MH
          </div>
          <div>
            <p className="font-medium text-gray-900">Matthieu van Haperen</p>
            <p>{content.author.title} · {locale === 'es' ? 'Actualizado Nov 2026' : 'Updated Nov 2026'}</p>
          </div>
        </div>

        <TldrSection>
          {content.tldr.map((item, index) => (
            <p key={index} dangerouslySetInnerHTML={{ __html: item }} />
          ))}
        </TldrSection>

        {/* The Real Cost of Free */}
        <h2 id="real-cost-free" className="text-2xl font-bold mt-12 mb-4 text-gray-900">
          {content.sections.realCostFree.title}
        </h2>

        <p className="mb-4 text-gray-700 leading-relaxed">
          {content.sections.realCostFree.p1}
        </p>

        <div className="bg-amber-50 p-6 rounded-lg mb-6">
          <h3 className="font-semibold text-amber-900 mb-3">{content.sections.realCostFree.boxTitle}</h3>
          <ul className="space-y-3 text-amber-800">
            {content.sections.realCostFree.items.map((item, i) => (
              <li key={i} className="flex items-start gap-2" dangerouslySetInnerHTML={{ __html: item.replace('💰', '<span class="text-amber-600 font-bold">💰</span><span>').replace('📉', '<span class="text-amber-600 font-bold">📉</span><span>').replace('🎨', '<span class="text-amber-600 font-bold">🎨</span><span>').replace('⏰', '<span class="text-amber-600 font-bold">⏰</span><span>').replace('📊', '<span class="text-amber-600 font-bold">📊</span><span>').replace(':', '</strong>') + '</span>' }} />
            ))}
          </ul>
        </div>

        <p className="mb-4 text-gray-700 leading-relaxed">
          {content.sections.realCostFree.p2}
        </p>

        {/* Side-by-Side Comparison Table */}
        <h2 id="comparison" className="text-2xl font-bold mt-12 mb-4 text-gray-900">
          {content.sections.comparison.title}
        </h2>

        <div className="overflow-x-auto mb-10">
          <table className="w-full border-collapse border border-gray-200">
            <thead>
              <tr className="bg-gray-50">
                {content.sections.comparison.table.headers.map((header, i) => (
                  <th key={i} className="border border-gray-200 p-3 text-left font-semibold">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {content.sections.comparison.table.rows.map((row, i) => (
                <tr key={i}>
                  <td className="border border-gray-200 p-3 font-medium">
                    {row[0]}
                  </td>
                  <td className="border border-gray-200 p-3 text-red-600">
                    {row[1]}
                  </td>
                  <td className="border border-gray-200 p-3 text-green-600">
                    {row[2]}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* What Free Tools Do Well */}
        <h2 id="free-tools-strengths" className="text-2xl font-bold mt-12 mb-4 text-gray-900">
          {content.sections.freeToolsStrengths.title}
        </h2>

        <p className="mb-4 text-gray-700 leading-relaxed">
          {content.sections.freeToolsStrengths.p1}
        </p>

        <div className="bg-green-50 p-6 rounded-lg mb-6">
          <h3 className="font-semibold text-green-900 mb-3">{content.sections.freeToolsStrengths.boxTitle}</h3>
          <ul className="space-y-2 text-green-800">
            {content.sections.freeToolsStrengths.items.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>

        <p className="mb-4 text-gray-700 leading-relaxed">
          {content.sections.freeToolsStrengths.p2}
        </p>

        {/* When to Invest */}
        <h2 id="when-to-invest" className="text-2xl font-bold mt-12 mb-4 text-gray-900">
          {content.sections.whenToInvest.title}
        </h2>

        <p className="mb-4 text-gray-700 leading-relaxed">
          {content.sections.whenToInvest.p1}
        </p>

        <div className="space-y-4 mb-6">
          {content.sections.whenToInvest.items.map((item, i) => (
            <div key={i} className="border-l-4 border-blue-500 pl-4">
              <h3 className="font-semibold text-gray-900">{item.title}</h3>
              <p className="text-gray-700">{item.text}</p>
            </div>
          ))}
        </div>

        {/* ROI Calculator */}
        <h2 id="roi" className="text-2xl font-bold mt-12 mb-4 text-gray-900">
          {content.sections.roi.title}
        </h2>

        <p className="mb-4 text-gray-700 leading-relaxed">
          {content.sections.roi.p1}
        </p>

        <div className="overflow-x-auto mb-6">
          <table className="w-full border-collapse border border-gray-200">
            <thead>
              <tr className="bg-gray-50">
                {content.sections.roi.table.headers.map((header, i) => (
                  <th key={i} className="border border-gray-200 p-3 text-left font-semibold">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {content.sections.roi.table.rows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td key={j} className="border border-gray-200 p-3 font-medium">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mb-4 text-gray-700 leading-relaxed">
          {content.sections.roi.p2}
        </p>

        {/* What to Look for in Paid Tools */}
        <h2 id="what-to-look-for" className="text-2xl font-bold mt-12 mb-4 text-gray-900">
          {content.sections.whatToLookFor.title}
        </h2>

        <p className="mb-4 text-gray-700 leading-relaxed">
          {content.sections.whatToLookFor.p1}
        </p>

        <div className="grid md:grid-cols-2 gap-4 mb-6">
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-semibold text-gray-900 mb-2">{content.sections.whatToLookFor.mustHaves.title}</h3>
            <ul className="space-y-1 text-gray-700 text-sm">
              {content.sections.whatToLookFor.mustHaves.items.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-semibold text-gray-900 mb-2">{content.sections.whatToLookFor.niceToHaves.title}</h3>
            <ul className="space-y-1 text-gray-700 text-sm">
              {content.sections.whatToLookFor.niceToHaves.items.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* Recommendations */}
        <h2 id="recommendations" className="text-2xl font-bold mt-12 mb-4 text-gray-900">
          {content.sections.recommendations.title}
        </h2>

        <div className="space-y-4 mb-6">
          {content.sections.recommendations.items.map((item, i) => (
            <div key={i} className="border border-gray-200 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-2">{item.title}</h3>
              <p className="text-gray-700 text-sm mb-2">{item.desc}</p>
              <p className="text-gray-500 text-sm">{locale === 'es' ? 'Mejor para' : 'Best for'}: {item.bestFor}</p>
            </div>
          ))}
        </div>

        {/* The Bottom Line */}
        <h2 id="bottom-line" className="text-2xl font-bold mt-12 mb-4 text-gray-900">
          {content.sections.bottomLine.title}
        </h2>

        <p className="mb-4 text-gray-700 leading-relaxed">
          {content.sections.bottomLine.p1}
        </p>

        <p className="mb-4 text-gray-700 leading-relaxed">
          {content.sections.bottomLine.p2}
        </p>

        <p className="mb-4 text-gray-700 leading-relaxed">
          {content.sections.bottomLine.p3}
        </p>

        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6">
          <p className="text-blue-900" dangerouslySetInnerHTML={{ __html: content.sections.bottomLine.boxText }} />
        </div>

        {/* FAQ Section */}
        <h2 id="faq" className="text-2xl font-bold mt-16 mb-6 text-gray-900">
          {content.faqTitle}
        </h2>

        <div className="space-y-6">
          {faqItems.map((item, index) => (
            <div key={index}>
              <h3 className="font-semibold text-lg mb-2 text-gray-900">
                {item.question}
              </h3>
              <p className="text-gray-700">{item.answer}</p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-16 p-8 bg-gray-50 rounded-lg text-center">
          <h2 className="text-2xl font-bold mb-4 text-gray-900">
            {content.cta.title}
          </h2>
          <p className="mb-6 text-gray-600">
            {content.cta.description}
          </p>
          <Link
            href="/"
            className="inline-block bg-brand-cta text-white px-8 py-4 rounded-lg hover:bg-brand-cta-hover transition-colors font-medium"
          >
            {content.cta.button}
          </Link>
        </div>

        <AuthorBox
          name="Matthieu van Haperen"
          title={content.author.title}
          bio={content.author.bio}
          linkedInUrl="https://linkedin.com/in/yourprofile"
        />
      </article>
    </>
  );
}
