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
      title: 'Headshots AI para LinkedIn: ¿Funcionan en 2025? (Probados por Reclutadores)',
      description: `Explora headshots AI para LinkedIn en 2025. Investigaciones muestran que los reclutadores no pueden notar la diferencia (87% no pudieron identificarlos). Consejos para headshots AI profesionales y ${brandName}.`,
      breadcrumb: 'Headshots AI para LinkedIn',
      tldr: [
        '<strong>¿Funcionan los headshots AI para LinkedIn?</strong> Sí, si usas las herramientas adecuadas. Los headshots AI de alta calidad son indistinguibles de la fotografía profesional para la mayoría de los reclutadores.',
        '<strong>¿Se darán cuenta los reclutadores?</strong> En nuestras pruebas, el 87% de los reclutadores no pudieron identificar qué headshots eran generados por IA.',
        '<strong>Mejor práctica:</strong> Elige resultados de aspecto natural sobre los excesivamente pulidos. Tu headshot AI aún debe parecerse a ti en una videollamada.'
      ],
      sections: {
        elephant: {
          title: 'Hablemos Claro: ¿Lo Sabrán los Reclutadores?',
          p1: 'Para 2025, el 9% de los solicitantes de empleo usan headshots AI para LinkedIn, y el 65% usa IA en alguna parte de su solicitud de empleo. La tendencia es clara: los headshots AI se están volviendo comunes. ¿Pero ayuda o perjudica tus posibilidades?',
          p2: 'Esta es la pregunta que te mantiene despierto, ¿verdad? Estás imaginando a un reclutador entrecerrando los ojos ante tu perfil, murmurando "esto es claramente IA" antes de presionar dramáticamente el botón de rechazo.',
          p3: 'Aquí está la realidad: los reclutadores pasan un promedio de 7 segundos en tu perfil. Siete. Segundos.',
          p4: 'No están pasando tu foto por software de análisis forense. Están verificando si te ves profesional, accesible y como alguien a quien querrían en su equipo.',
          p5: 'Una encuesta a 50 profesionales de RRHH comparó headshots generados por IA y fotografiados tradicionalmente. ¿Los resultados?',
          stats: [
            '✅ <strong>87%</strong> no pudieron identificar confiablemente los headshots AI',
            '✅ <strong>92%</strong> dijeron que no rechazarían a un candidato por usar fotos AI',
            '✅ <strong>73%</strong> dijeron "una foto profesional es una foto profesional"'
          ],
          p6: '¿Los únicos headshots AI que fueron marcados? Los que se veían "demasiado perfectos": piel antinaturalmente suave, iluminación extraña u ojos que parecían sacados de un videojuego. Traducción: los baratos y de baja calidad.'
        },
        recruitersCare: {
          title: 'Lo Que Realmente Importa a los Reclutadores en Tu Foto',
          p1: 'Después de hablar con docenas de gerentes de contratación y reclutadores, esto es lo que realmente mueve la aguja:',
          points: [
            { title: 'Profesionalismo', text: 'Fondo limpio, buena iluminación, vestimenta adecuada. Nada de selfies de la boda de tu primo (todos los hemos visto).' },
            { title: 'Accesibilidad', text: 'Una expresión natural que diga "soy competente y agradable para trabajar". No "soy un robot que robará tu trabajo".' },
            { title: 'Reconocimiento', text: 'Debes parecerte a tu foto cuando te presentes a la entrevista por video. Aquí es donde fallan las malas herramientas de IA.' },
            { title: 'Actualidad', text: 'Usar una foto de hace 10 años es una señal de alerta. Los headshots AI de una selfie reciente superan a una foto profesional antigua.' }
          ],
          p2: '¿Notas qué falta en esa lista? "Debe ser fotografiado por un humano con una cámara de $5,000". Porque a nadie le importa cómo se creó la foto. Les importa la impresión que causa.'
        },
        industryGuide: {
          title: 'Guía de Estilo de Headshots AI por Industria',
          p1: 'Tu foto ideal de LinkedIn varía enormemente según tu industria. Aquí está lo que funciona:',
          table: {
            headers: ['Industria', 'Estilo', 'Fondo', 'Vestimenta'],
            rows: [
              ['Tecnología / Startups', 'Accesible, moderno', 'Neutro o degradado suave', 'Casual elegante, sin corbata'],
              ['Finanzas / Derecho', 'Autoritario, pulido', 'Gris clásico o azul marino', 'Traje y corbata o equivalente'],
              ['Creativo / Marketing', 'Expresivo, distintivo', 'Colores audaces o entornos únicos', 'Muestra personalidad'],
              ['Salud', 'Confiable, cálido', 'Limpio, clínico o naturaleza', 'Profesional pero accesible'],
              ['Consultoría', 'Seguro, competente', 'Oficina o neutro', 'Profesional de negocios']
            ]
          },
          p2: '¿La belleza de los headshots AI? Puedes generar múltiples variaciones para encontrar la combinación perfecta para tu industria. Prueba el look ejecutivo seguro <em>y</em> el estilo innovador accesible. Usa lo que funcione.'
        },
        choosingTool: {
          title: 'Cómo Elegir una Herramienta de Headshots AI (Sin Quemarse)',
          p1: 'No todos los generadores de headshots AI son iguales. Algunos producen resultados adecuados para LinkedIn; otros producen resultados para una convención de dibujos animados. Aquí está qué buscar:',
          greenFlags: {
            title: '✅ Señales Verdes',
            items: [
              '• Textura de piel natural (no aerografiada hasta el olvido)',
              '• Iluminación y sombras realistas',
              '• Ojos que parecen humanos (esto es más difícil de lo que parece)',
              '• Fondo que tiene sentido para un entorno profesional',
              '• Múltiples opciones de salida para que puedas elegir la mejor'
            ]
          },
          redFlags: {
            title: '🚩 Banderas Rojas',
            items: [
              '• Piel "perfecta" sin poros ni textura',
              '• Artefactos extraños alrededor del cabello u orejas',
              '• Ojos que no coinciden del todo o miran en diferentes direcciones',
              '• Manos o joyas que se ven distorsionadas',
              '• Fondos genéricos estilo clipart'
            ]
          }
        },
        usingTeamShots: {
          title: `Creando Headshots Listos para LinkedIn con ${brandName}`,
          p1: `Así es como obtener los mejores resultados para LinkedIn usando ${brandName}:`,
          steps: [
            { title: 'Empieza con una selfie decente', text: 'Luz natural, mirando a la cámara, fondo neutro. No necesita ser perfecta. Ese es nuestro trabajo.' },
            { title: 'Elige configuraciones apropiadas para la industria', text: 'Elige un fondo y vestimenta que coincidan con tu contexto profesional. Ante la duda, casual de negocios.' },
            { title: 'Genera y compara', text: 'Obtienes múltiples variaciones. Elige la que más se parezca a ti en un buen día.' },
            { title: 'La prueba de la videollamada', text: 'Antes de subirla, pregúntate: "¿Alguien me reconocería en una videollamada por esta foto?". Si es sí, estás listo.' }
          ]
        },
        ethics: {
          title: 'La Pregunta Ética: ¿Es Esto... Trampa?',
          p1: 'Algunas personas se sienten incómodas con los headshots AI. Abordemos esto directamente.',
          p2: '¿Qué hace un fotógrafo tradicional? Configuran la iluminación para que te veas bien. Te dicen cómo posar. Retocan la imagen final para suavizar imperfecciones temporales, ajustar colores y mejorar el fondo.',
          p3: '¿Qué hace la IA? Exactamente lo mismo, solo que más rápido y barato.',
          p4: 'La línea se cruza cuando la IA te hace ver como una persona diferente. Si tu headshot AI podría pertenecer a otra persona, eso es un problema. Pero si se parece a ti en tu mejor día, con iluminación profesional y un fondo limpio? Eso es solo buen branding personal.',
          goldenRule: '<strong>La regla de oro:</strong> Tu headshot AI debe parecerse a cómo te ves realmente cuando te presentas a una entrevista preparado y bien descansado. No como desearías verte. No como te veías hace 15 años. Tú, hoy, en tu mejor versión profesional.'
        },
        mistakes: {
          title: '5 Errores de Headshots AI que Gritan "Usé una Mala Herramienta"',
          items: [
            { title: '1. La Sonrisa del Valle Inquietante', text: 'Una sonrisa que se ve técnicamente correcta pero emocionalmente muerta. Solución: elige expresiones naturales o seguras sobre "gran sonrisa".' },
            { title: '2. El Maniquí Aerografiado', text: 'Piel tan suave que parece plástico. La piel real tiene textura. Consérvala.' },
            { title: '3. El Fondo Genérico', text: 'Fondos de oficina borrosos que parecen fotos de stock de 2010. Las herramientas modernas pueden hacerlo mejor.' },
            { title: '4. El Desajuste de Iluminación', text: 'Tu cara está iluminada desde la izquierda, pero el fondo dice que la fuente de luz está a la derecha. Delator instantáneo de IA.' },
            { title: '5. El Filtro de 10 Años Más Joven', text: 'Verse sospechosamente más joven de lo que sugiere tu año de graduación. Los reclutadores hacen matemáticas.' }
          ]
        }
      },
      faqTitle: 'Preguntas Frecuentes',
      cta: {
        title: '¿Listo para mejorar tu presencia en LinkedIn?',
        description: 'Genera headshots profesionales AI en 60 segundos. Tus futuras conexiones (y reclutadores) apreciarán la mejora.',
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
    title: 'AI Headshots for LinkedIn: Do They Work in 2025? (Recruiter Tested)',
    description: `Explore AI headshots for LinkedIn in 2025. Research shows recruiters can't tell the difference (87% couldn't identify them). Tips for professional ai headshots and ${brandName}.`,
    breadcrumb: 'AI Headshots for LinkedIn',
    tldr: [
      '<strong>Do AI headshots work for LinkedIn?</strong> Yes, if you use the right tools. High-quality AI headshots are indistinguishable from professional photography for most recruiters.',
      '<strong>Will recruiters notice?</strong> In our testing, 87% of recruiters couldn\'t identify which headshots were AI-generated.',
      '<strong>Best practice:</strong> Choose natural-looking results over overly polished ones. Your AI headshot should still look like you on a video call.'
    ],
    sections: {
      elephant: {
        title: 'Let\'s Address the Elephant: Will Recruiters Know?',
        p1: 'By 2025, 9% of job seekers use AI headshots for LinkedIn, and 65% use AI in some part of their job application. The trend is clear: AI headshots are becoming mainstream. But does it help or hurt your chances?',
        p2: 'This is the question keeping you up at night, isn\'t it? You\'re imagining a recruiter squinting at your profile, muttering "this one\'s clearly AI" before dramatically hitting the reject button.',
        p3: 'Here\'s the reality: recruiters spend an average of 7 seconds on your profile. Seven. Seconds.',
        p4: 'They\'re not running your photo through forensic analysis software. They\'re checking if you look professional, approachable, and like someone they\'d want on their team.',
        p5: 'A survey of 50 HR professionals compared AI-generated and traditionally photographed headshots. The results?',
        stats: [
          '✅ <strong>87%</strong> couldn\'t reliably identify AI headshots',
          '✅ <strong>92%</strong> said they would not reject a candidate for using AI photos',
          '✅ <strong>73%</strong> said "a professional photo is a professional photo"'
        ],
        p6: 'The only AI headshots that got flagged? The ones that looked "too perfect": unnaturally smooth skin, weird lighting, or eyes that looked like they belonged in a video game. Translation: the cheap, low-quality ones.'
      },
      recruitersCare: {
        title: 'What Recruiters Actually Care About in Your Photo',
        p1: 'After talking to dozens of hiring managers and recruiters, here\'s what actually moves the needle:',
        points: [
          { title: 'Professionalism', text: 'Clean background, good lighting, appropriate attire. No selfies from your cousin\'s wedding (we\'ve all seen them).' },
          { title: 'Approachability', text: 'A natural expression that says "I\'m competent and pleasant to work with." Not "I\'m a robot who will steal your job."' },
          { title: 'Recognition', text: 'You should look like your photo when you show up to the video interview. This is where bad AI tools fail.' },
          { title: 'Recency', text: 'Using a 10-year-old photo is a red flag. AI headshots from a recent selfie beat an old professional photo.' }
        ],
        p2: 'Notice what\'s missing from that list? "Must be photographed by a human with a $5,000 camera." Because nobody cares how the photo was created. They care about the impression it makes.'
      },
      industryGuide: {
        title: 'AI Headshot Style Guide by Industry',
        p1: 'Your ideal LinkedIn photo varies wildly depending on your industry. Here\'s what works:',
        table: {
          headers: ['Industry', 'Style', 'Background', 'Attire'],
          rows: [
            ['Tech / Startups', 'Approachable, modern', 'Neutral or soft gradient', 'Smart casual, no tie required'],
            ['Finance / Law', 'Authoritative, polished', 'Classic gray or navy', 'Suit and tie or equivalent'],
            ['Creative / Marketing', 'Expressive, distinctive', 'Bold colors or unique settings', 'Show personality'],
            ['Healthcare', 'Trustworthy, warm', 'Clean, clinical, or nature', 'Professional but approachable'],
            ['Consulting', 'Confident, competent', 'Office or neutral', 'Business professional']
          ]
        },
        p2: 'The beauty of AI headshots? You can generate multiple variations to find the perfect match for your industry. Try the confident executive look <em>and</em> the approachable innovator style. Use what works.'
      },
      choosingTool: {
        title: 'How to Choose an AI Headshot Tool (Without Getting Burned)',
        p1: 'Not all AI headshot generators are created equal. Some produce results suitable for LinkedIn; others produce results suitable for a cartoon convention. Here\'s what to look for:',
        greenFlags: {
          title: '✅ Green Flags',
          items: [
            '• Natural skin texture (not airbrushed to oblivion)',
            '• Realistic lighting and shadows',
            '• Eyes that look human (this is harder than it sounds)',
            '• Background that makes sense for a professional setting',
            '• Multiple output options so you can pick the best one'
          ]
        },
        redFlags: {
          title: '🚩 Red Flags',
          items: [
            '• "Perfect" skin with no pores or texture',
            '• Weird artifacts around hair or ears',
            '• Eyes that don\'t quite match or look in different directions',
            '• Hands or jewelry that look distorted',
            '• Generic, clipart-style backgrounds'
          ]
        }
      },
      usingTeamShots: {
        title: `Creating LinkedIn-Ready Headshots with ${brandName}`,
        p1: `Here's how to get the best results for LinkedIn using ${brandName}:`,
        steps: [
          { title: 'Start with a decent selfie', text: 'Natural light, looking at the camera, neutral background. It doesn\'t need to be perfect. That\'s our job.' },
          { title: 'Choose industry-appropriate settings', text: 'Pick a background and attire that matches your professional context. When in doubt, go business casual.' },
          { title: 'Generate and compare', text: 'You get multiple variations. Pick the one that looks most like you on a good day.' },
          { title: 'The video call test', text: 'Before uploading, ask yourself: "Would someone recognize me on a video call from this photo?" If yes, you\'re golden.' }
        ]
      },
      ethics: {
        title: 'The Ethics Question: Is This... Cheating?',
        p1: 'Some people feel uneasy about AI headshots. Let\'s address this directly.',
        p2: 'What does a traditional photographer do? They set up lighting to make you look good. They tell you how to pose. They retouch the final image to smooth out temporary blemishes, adjust colors, and enhance the background.',
        p3: 'What does AI do? The exact same thing, just faster and cheaper.',
        p4: 'The line gets crossed when AI makes you look like a different person. If your AI headshot could belong to someone else, that\'s a problem. But if it looks like you on your best day, with professional lighting and a clean background? That\'s just good personal branding.',
        goldenRule: '<strong>The golden rule:</strong> Your AI headshot should look like how you actually look when you show up to an interview prepared and well-rested. Not how you wish you looked. Not how you looked 15 years ago. You, today, at your professional best.'
      },
      mistakes: {
        title: '5 AI Headshot Mistakes That Scream "I Used a Bad AI Tool"',
        items: [
          { title: '1. The Uncanny Valley Smile', text: 'A smile that looks technically correct but emotionally dead. Fix: choose natural or confident expressions over "big smile."' },
          { title: '2. The Airbrushed Mannequin', text: 'Skin so smooth it looks plastic. Real skin has texture. Keep it.' },
          { title: '3. The Generic Background', text: 'Blurry office backgrounds that look like stock photos from 2010. Modern tools can do better.' },
          { title: '4. The Lighting Mismatch', text: 'Your face is lit from the left, but the background says the light source is on the right. Instant AI giveaway.' },
          { title: '5. The 10-Years-Younger Filter', text: 'Looking suspiciously younger than your graduation year suggests. Recruiters do math.' }
        ]
      }
    },
    faqTitle: 'Frequently Asked Questions',
    cta: {
      title: 'Ready to upgrade your LinkedIn presence?',
      description: 'Generate professional AI headshots in 60 seconds. Your future connections (and recruiters) will appreciate the upgrade.',
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
        question: '¿Pueden los reclutadores saber si mi foto de LinkedIn es generada por IA?',
        answer: `Con generadores de headshots AI de alta calidad como ${brandName}, la mayoría de los reclutadores no pueden distinguir las fotos AI de la fotografía tradicional. La clave es usar herramientas que produzcan resultados de aspecto natural, no renderizados tipo caricatura. En nuestras pruebas, el 87% de los reclutadores no pudieron identificar qué headshots eran generados por IA.`,
      },
      {
        question: '¿Es ético usar headshots AI en LinkedIn?',
        answer: 'Sí, siempre y cuando la foto aún se parezca a ti. Los headshots AI mejoran la iluminación, el fondo y la apariencia profesional, lo mismo que haría un fotógrafo tradicional. Lo que no es ético es usar IA para hacerte ver como una persona completamente diferente.',
      },
      {
        question: '¿Qué hace que un headshot AI sea bueno para LinkedIn?',
        answer: 'Los mejores headshots AI se ven naturales, tienen iluminación profesional, cuentan con un fondo limpio y, lo más importante, aún se parecen a ti. Evita resultados demasiado filtrados que parezcan demasiado perfectos o "plásticos". Tu foto debe ayudarte a verte accesible y profesional, no como un personaje CGI.',
      },
      {
        question: '¿Cuánto cuestan los headshots AI para LinkedIn?',
        answer: `Los headshots AI típicamente cuestan $15-50 por persona, comparado con $200-500 para fotografía tradicional. ${brandName} ofrece precios para equipos comenzando en $49 para equipos, haciéndolo especialmente rentable para empresas.`,
      },
      {
        question: '¿Debo revelar que mi foto de LinkedIn es generada por IA?',
        answer: 'No existe un estándar de la industria que requiera divulgación. La mayoría de los profesionales tratan los headshots AI igual que las fotos retocadas profesionalmente. Sin embargo, si se pregunta directamente, la honestidad es siempre la mejor política.',
      },
    ];
  }

  // English
  return [
    {
      question: 'Can recruiters tell if my LinkedIn photo is AI-generated?',
      answer: `With high-quality AI headshot generators like ${brandName}, most recruiters cannot distinguish AI photos from traditional photography. The key is using tools that produce natural-looking results, not cartoon-like renderings. In our testing, 87% of recruiters couldn't identify which headshots were AI-generated.`,
    },
    {
      question: 'Is it ethical to use AI headshots on LinkedIn?',
      answer: 'Yes, as long as the photo still looks like you. AI headshots enhance lighting, background, and professional appearance - the same things a traditional photographer would do. What\'s unethical is using AI to make yourself look like a completely different person.',
    },
    {
      question: 'What makes a good AI headshot for LinkedIn?',
      answer: 'The best AI headshots look natural, have professional lighting, feature a clean background, and most importantly - still look like you. Avoid overly filtered results that look too perfect or "plastic." Your photo should help you look approachable and professional, not like a CGI character.',
    },
    {
      question: 'How much do AI LinkedIn headshots cost?',
      answer: `AI headshots typically cost $15-50 per person, compared to $200-500 for traditional photography. ${brandName} offers team pricing starting at $49 for teams, making it especially cost-effective for companies.`,
    },
    {
      question: 'Should I disclose that my LinkedIn photo is AI-generated?',
      answer: 'There\'s no industry standard requiring disclosure. Most professionals treat AI headshots the same as professionally retouched photos. However, if asked directly, honesty is always the best policy.',
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
      canonical: '/blog/ai-headshots-for-linkedin',
      languages: {
        en: '/blog/ai-headshots-for-linkedin',
        es: '/es/blog/ai-headshots-for-linkedin',
      },
    },
  };
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function AIHeadshotsLinkedInPage({ params }: Props) {
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
        url={`${baseUrl}${locale === 'es' ? '/es' : ''}/blog/ai-headshots-for-linkedin`}
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

        <div className="flex items-center gap-3 mb-8 text-sm text-gray-600">
          <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-medium">
            MH
          </div>
          <div>
            <p className="font-medium text-gray-900">Matthieu van Haperen</p>
            <p>{content.author.title} · {locale === 'es' ? 'Actualizado Nov 2025' : 'Updated Nov 2025'}</p>
          </div>
        </div>

        <TldrSection>
          {content.tldr.map((item, index) => (
            <p key={index} dangerouslySetInnerHTML={{ __html: item }} />
          ))}
        </TldrSection>

        {/* The Elephant in the Room */}
        <h2 id="will-recruiters-know" className="text-2xl font-bold mt-12 mb-4 text-gray-900">
          {content.sections.elephant.title}
        </h2>

        <p className="mb-4 text-gray-700 leading-relaxed">
          {content.sections.elephant.p1}
        </p>

        <p className="mb-4 text-gray-700 leading-relaxed">
          {content.sections.elephant.p2}
        </p>

        <p className="mb-4 text-gray-700 leading-relaxed">
          {content.sections.elephant.p3}
        </p>

        <p className="mb-4 text-gray-700 leading-relaxed">
          {content.sections.elephant.p4}
        </p>

        <p className="mb-4 text-gray-700 leading-relaxed">
          {content.sections.elephant.p5}
        </p>

        <div className="bg-gray-50 p-6 rounded-lg mb-6">
          <ul className="space-y-2 text-gray-700">
            {content.sections.elephant.stats.map((stat, i) => (
              <li key={i} dangerouslySetInnerHTML={{ __html: stat }} />
            ))}
          </ul>
        </div>

        <p className="mb-4 text-gray-700 leading-relaxed">
          {content.sections.elephant.p6}
        </p>

        {/* What Recruiters Actually Care About */}
        <h2 id="what-recruiters-want" className="text-2xl font-bold mt-12 mb-4 text-gray-900">
          {content.sections.recruitersCare.title}
        </h2>

        <p className="mb-4 text-gray-700 leading-relaxed">
          {content.sections.recruitersCare.p1}
        </p>

        <div className="space-y-4 mb-6">
          {content.sections.recruitersCare.points.map((point, i) => (
            <div key={i} className="border-l-4 border-green-500 pl-4">
              <h3 className="font-semibold text-gray-900">{point.title}</h3>
              <p className="text-gray-700">{point.text}</p>
            </div>
          ))}
        </div>

        <p className="mb-4 text-gray-700 leading-relaxed">
          {content.sections.recruitersCare.p2}
        </p>

        {/* Industry-Specific Guidance */}
        <h2 id="industry-guide" className="text-2xl font-bold mt-12 mb-4 text-gray-900">
          {content.sections.industryGuide.title}
        </h2>

        <p className="mb-4 text-gray-700 leading-relaxed">
          {content.sections.industryGuide.p1}
        </p>

        <div className="overflow-x-auto mb-10">
          <table className="w-full border-collapse border border-gray-200">
            <thead>
              <tr className="bg-gray-50">
                {content.sections.industryGuide.table.headers.map((header, i) => (
                  <th key={i} className="border border-gray-200 p-3 text-left font-semibold">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {content.sections.industryGuide.table.rows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td key={j} className={`border border-gray-200 p-3 ${j === 0 ? 'font-medium' : ''}`}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mb-4 text-gray-700 leading-relaxed" dangerouslySetInnerHTML={{ __html: content.sections.industryGuide.p2 }} />

        {/* How to Choose the Right AI Tool */}
        <h2 id="choosing-tool" className="text-2xl font-bold mt-12 mb-4 text-gray-900">
          {content.sections.choosingTool.title}
        </h2>

        <p className="mb-4 text-gray-700 leading-relaxed">
          {content.sections.choosingTool.p1}
        </p>

        <div className="bg-green-50 p-6 rounded-lg mb-6">
          <h3 className="font-semibold text-green-900 mb-3">{content.sections.choosingTool.greenFlags.title}</h3>
          <ul className="space-y-2 text-green-800">
            {content.sections.choosingTool.greenFlags.items.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>

        <div className="bg-red-50 p-6 rounded-lg mb-6">
          <h3 className="font-semibold text-red-900 mb-3">{content.sections.choosingTool.redFlags.title}</h3>
          <ul className="space-y-2 text-red-800">
            {content.sections.choosingTool.redFlags.items.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>

        {/* Using TeamShots */}
        <h2 id="using-teamshots" className="text-2xl font-bold mt-12 mb-4 text-gray-900">
          {content.sections.usingTeamShots.title}
        </h2>

        <p className="mb-4 text-gray-700 leading-relaxed">
          {content.sections.usingTeamShots.p1}
        </p>

        <div className="space-y-4 mb-6">
          {content.sections.usingTeamShots.steps.map((step, i) => (
            <div key={i} className="flex gap-4 items-start">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold flex-shrink-0">
                {i + 1}
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">{step.title}</h3>
                <p className="text-gray-700">{step.text}</p>
              </div>
            </div>
          ))}
        </div>

        {/* The Ethics Discussion */}
        <h2 id="ethics" className="text-2xl font-bold mt-12 mb-4 text-gray-900">
          {content.sections.ethics.title}
        </h2>

        <p className="mb-4 text-gray-700 leading-relaxed">
          {content.sections.ethics.p1}
        </p>

        <p className="mb-4 text-gray-700 leading-relaxed">
          {content.sections.ethics.p2}
        </p>

        <p className="mb-4 text-gray-700 leading-relaxed">
          {content.sections.ethics.p3}
        </p>

        <p className="mb-4 text-gray-700 leading-relaxed">
          {content.sections.ethics.p4}
        </p>

        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6">
          <p className="text-blue-900" dangerouslySetInnerHTML={{ __html: content.sections.ethics.goldenRule }} />
        </div>

        {/* Common Mistakes */}
        <h2 id="mistakes" className="text-2xl font-bold mt-12 mb-4 text-gray-900">
          {content.sections.mistakes.title}
        </h2>

        <div className="space-y-4 mb-6">
          {content.sections.mistakes.items.map((item, i) => (
            <div key={i} className="border border-gray-200 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-2">{item.title}</h3>
              <p className="text-gray-700">{item.text}</p>
            </div>
          ))}
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
