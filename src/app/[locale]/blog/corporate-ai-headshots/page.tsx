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
  BlogHeroImage,
} from '@/components/blog';
import { postMeta } from './meta';

type Props = {
  params: Promise<{ locale: string }>;
};

const getContent = (locale: string, brandName: string) => {
  if (locale === 'es') {
    return {
      title: postMeta.es.title,
      description: postMeta.es.description,
      breadcrumb: 'Headshots AI Corporativos',
      tldr: [
        '<strong>Ahorro de costos:</strong> Los headshots AI cuestan $15-50/persona vs $200-500/persona para fotografía tradicional. Eso es un ahorro del 80-90%.',
        '<strong>El problema de equipos remotos:</strong> Las sesiones de fotos tradicionales son logísticamente imposibles para equipos distribuidos. La IA resuelve esto completamente.',
        '<strong>El desafío clave:</strong> La mayoría de herramientas AI procesan personas individualmente, creando fotos de equipo inconsistentes. Elige herramientas construidas para consistencia de equipo.'
      ],
      sections: {
        problem: {
          title: 'La Pesadilla de los Headshots de Equipos Remotos (Conoces Esta)',
          p1: 'Déjame pintar una imagen que probablemente has vivido:',
          p2: 'Necesitas actualizar la página "Sobre Nosotros" de tu empresa. Tu equipo está repartido en 5 zonas horarias.',
          p3: 'Las últimas fotos del equipo se tomaron hace 3 años, y 4 de esas personas se han ido. Tu contratación más reciente en Berlín nunca ha estado en la sede.',
          solutions: {
            title: 'Soluciones Tradicionales (Todas Terribles)',
            items: [
              '❌ <strong>Volar a todos a la sede:</strong> Pesadilla presupuestaria, caos de programación, culpa por huella de carbono',
              '❌ <strong>Contratar fotógrafos locales:</strong> Resultados inconsistentes, iluminación diferente, fondos que no coinciden',
              '❌ <strong>Pedir a la gente que envíe sus propias fotos:</strong> Hola, selfies en la playa y recortes de bodas junto al headshot profesional de tu CFO',
              '❌ <strong>Omitirlo por completo:</strong> Avatares anónimos o sin fotos = "¿quiénes son estas personas en las que se supone que debemos confiar?"'
            ]
          },
          p4: 'Es exactamente por esto que existen los headshots corporativos AI. No como un truco, sino como la única solución práctica para equipos modernos.'
        },
        costComparison: {
          title: 'La Comparación de Costos Real (Con Números Reales)',
          p1: 'Hagamos las matemáticas para un equipo de 20 personas:',
          table: {
            headers: ['Factor de Costo', 'Fotografía Tradicional', `Headshots AI (${brandName})`],
            rows: [
              ['Costo por persona', '$200-350', '$3-10'],
              ['Tiempo de coordinación (horas de RRHH)', '10-20 horas', '1-2 horas'],
              ['Tiempo del empleado', '2-4 horas cada uno', '5-10 minutos cada uno'],
              ['Costos de viaje/lugar', '$500-5,000', '$0'],
              ['Tiempo de entrega', '2-4 semanas', 'Mismo día'],
              ['Total para 20 personas', '$5,000-12,000', '$60-200'] // Special row handling in JSX
            ]
          },
          p2: 'Y esos números ni siquiera capturan el mayor costo: lograr que 20 personas ocupadas aparezcan en el mismo lugar al mismo tiempo. Si alguna vez has organizado una sesión de fotos de equipo, sabes que esto es básicamente imposible.'
        },
        bestPractices: {
          title: 'Mejores Prácticas para Headshots AI Corporativos 2025',
          p1: 'Basado en investigaciones de 2025 y mejores prácticas de la industria, esto es lo que funciona para equipos corporativos:',
          list: {
            title: '✅ Mejores Prácticas 2025',
            items: [
              '• Usa selfies nítidas y de alta calidad como entrada para resultados claros',
              '• Mantén la consistencia en todos los canales corporativos (LinkedIn, firmas de correo, sitios web)',
              '• Asegura la autenticidad manteniendo rasgos faciales clave consistentes',
              '• Alinea los headshots con tu marca corporativa (vestimenta, fondo, expresión)',
              '• Prueba los headshots generados por IA con RRHH o colegas de confianza antes del lanzamiento',
              '• Elige herramientas con procesamiento por lotes para consistencia de equipo'
            ]
          }
        },
        consistency: {
          title: 'El Problema de la Consistencia (Por Qué la Mayoría de Herramientas AI Fallan a los Equipos)',
          p1: 'Aquí es donde la mayoría de las herramientas de headshots AI se quedan cortas para uso corporativo:',
          p2: 'Procesan a cada persona individualmente. La Persona A obtiene un fondo de oficina cálido. La Persona B obtiene iluminación fría sobre un fondo gris. La Persona C parece estar en un edificio completamente diferente.',
          mismatchedBox: {
            title: 'La Galería de Equipo Despareja',
            text1: 'Has visto estas páginas de empresas. Parece que tomaron fotos de perfil de LinkedIn aleatorias de 15 personas diferentes (porque eso es exactamente lo que hicieron).',
            text2: 'La señal que esto envía a los visitantes: "En realidad no somos un equipo cohesivo. Solo compartimos un espacio de trabajo en Slack."'
          },
          p3: 'Para headshots corporativos, la consistencia importa. Mismo fondo. Misma iluminación. Mismo estilo profesional. Tu equipo debe parecer un equipo.',
          consistencyBox: {
            title: 'Cómo se ve la Consistencia',
            items: [
              '✅ Fondos coincidentes en todos los miembros del equipo',
              '✅ Iluminación y temperatura de color consistentes',
              '✅ Encuadre similar (headshots vs. medio cuerpo)',
              '✅ Estilos de vestimenta complementarios (incluso si no son idénticos)',
              '✅ Esquemas de color apropiados para la marca'
            ]
          }
        },
        implementation: {
          title: 'Cómo Implementar Headshots Corporativos AI (Paso a Paso)',
          p1: 'Aquí está el proceso que realmente funciona para equipos remotos:',
          steps: [
            {
              title: 'Define Tu Guía de Estilo (15 minutos)',
              text: 'Antes de que nadie suba una selfie, decide:',
              list: ['Fondo: ¿Color sólido? ¿Degradado? ¿Entorno de oficina?', 'Vestimenta: ¿Formal de negocios? ¿Casual elegante? ¿Específico de la industria?', 'Encuadre: ¿Solo cara o pecho hacia arriba?', 'Expresión: ¿Segura? ¿Accesible? ¿Apropiada para la industria?']
            },
            {
              title: 'Elige Tu Herramienta AI Sabiamente',
              text: `Busca herramientas diseñadas para equipos, no individuos. Características clave: procesamiento por lotes, aplicación de estilo consistente y panel de administración para revisión. ${brandName} fue construido específicamente para este caso de uso.`
            },
            {
              title: 'Envía Invitaciones al Equipo (5 minutos)',
              text: 'Cada miembro del equipo recibe un enlace para subir su selfie. Pueden hacerlo desde su teléfono en 2 minutos. Sin descargas de aplicaciones, sin creación de cuentas requerida.'
            },
            {
              title: 'Miembros del Equipo Suben Selfies (2-3 minutos cada uno)',
              text: 'Guíalos sobre qué hace una buena selfie:',
              list: ['Iluminación natural (cerca de una ventana funciona genial)', 'Mirar directamente a la cámara', 'Fondo neutro (no necesita ser perfecto)', 'Sin filtros ni maquillaje pesado']
            },
            {
              title: 'Revisar y Descargar (10 minutos)',
              text: 'Los resultados aparecen en tu panel de administración. Revisa cada headshot, solicita regeneraciones si es necesario, luego descarga el conjunto completo. Listo.'
            }
          ]
        },
        cameraShy: {
          title: 'Manejo de los Miembros del Equipo "Odio Ser Fotografiado"',
          p1: 'Cada equipo los tiene. ¿Y honestamente? Los headshots AI son realmente más fáciles para las personas tímidas ante la cámara que la fotografía tradicional.',
          traditional: {
            title: 'Sesión de Fotos Tradicional 😰',
            items: ['• Fotógrafo mirándolos', '• Colegas esperando su turno', '• Presión para "actuar" bajo demanda', '• Tomas limitadas (presión de tiempo)', '• Ver resultados semanas después']
          },
          ai: {
            title: 'Headshot AI 😌',
            items: ['• Tomar selfies en privado', '• Tomar tantas como quieran', '• Elegir su mejor foto', '• Ver resultados inmediatamente', '• Solicitar regeneraciones si es necesario']
          },
          p2: 'La naturaleza de autoservicio de los headshots AI reduce la ansiedad por las fotos. La gente se siente más en control, y eso generalmente conduce a mejores resultados.'
        },
        objections: {
          title: 'Abordando a los Escépticos (Objeciones Comunes)',
          items: [
            { title: '"Las fotos AI se ven falsas"', text: 'Las malas fotos AI se ven falsas. Las buenas fotos AI se ven como fotografía profesional, porque usan los mismos principios: iluminación adecuada, fondos limpios y poses naturales. La tecnología ha mejorado dramáticamente en los últimos 2 años.' },
            { title: '"No se verá lo suficientemente profesional para nuestra marca"', text: '¿Dirías lo mismo sobre el retoque profesional? Los headshots AI hacen lo que los fotógrafos siempre han hecho: optimizar la iluminación, limpiar fondos y presentar a las personas bajo su mejor luz profesional. El resultado es indistinguible.' },
            { title: '"Nuestro liderazgo no aprobará esto"', text: 'Muéstrales la comparación de costos. Fotografía tradicional para un equipo de 20 personas: $5,000-12,000. Headshots AI: $60-200. Más entrega rápida y sin caos de programación. El caso de ROI prácticamente se hace solo.' },
            { title: '"¿Qué hay de la privacidad de datos?"', text: `Preocupación válida. Elige herramientas AI con políticas de privacidad claras. ${brandName} usa encriptación de grado empresarial, no entrena con tus fotos y elimina automáticamente los datos después de 30 días. Las fotos siguen siendo tu propiedad.` }
          ]
        },
        traditionalSense: {
          title: 'Cuando la Fotografía Tradicional Aún Tiene Sentido',
          p1: 'No voy a fingir que la IA resuelve todos los casos de uso. La fotografía tradicional sigue siendo mejor para:',
          list: [
            '• <strong>Ejecutivos C-suite</strong> que necesitan retratos premium estilo editorial',
            '• <strong>Materiales para inversores</strong> donde el valor de producción percibido importa',
            '• <strong>Imágenes de oficina física</strong> mostrando tu espacio real',
            '• <strong>Fotos grupales</strong> (la IA maneja individuos, no composiciones grupales)',
            '• <strong>Equipos de 3-5 en la misma ubicación</strong> donde la logística no es un problema'
          ],
          p2: 'El enfoque híbrido funciona bien: fotografía tradicional para ejecutivos y materiales de marketing, headshots AI para el equipo general. Lo mejor de ambos mundos.'
        }
      },
      faqTitle: 'Preguntas Frecuentes',
      cta: {
        title: '¿Listo para mejorar la imagen profesional de tu equipo?',
        description: 'Obtén headshots consistentes y profesionales para todo tu equipo en un día. Sin fotógrafos, sin drama de programación.',
        button: `Prueba ${brandName} para Equipos →`
      },
      author: {
        title: `Fundador, ${brandName}`,
        bio: `Matthieu van Haperen es el fundador de ${brandName} y un ex venture builder con más de 6 años de experiencia en startups. Escribe sobre herramientas de IA, productividad y construcción en público.`
      }
    };
  }

  // English
  return {
    title: postMeta.en.title,
    description: postMeta.en.description,
    breadcrumb: 'Corporate AI Headshots',
    tldr: [
      '<strong>Cost savings:</strong> AI headshots cost $15-50/person vs. $200-500/person for traditional photography. That\'s 80-90% savings.',
      '<strong>The remote team problem:</strong> Traditional photo shoots are logistically impossible for distributed teams. AI solves this completely.',
      '<strong>The key challenge:</strong> Most AI tools process people individually, creating inconsistent team photos. Choose tools built for team consistency.'
    ],
    sections: {
      problem: {
        title: 'The Remote Team Headshot Nightmare (You Know This One)',
        p1: 'Let me paint a picture you\'ve probably lived through:',
        p2: 'You need to update your company\'s "About Us" page. Your team is spread across 5 time zones.',
        p3: 'The last team photos were taken 3 years ago, and 4 of those people have left. Your newest hire in Berlin has never been to headquarters.',
        solutions: {
          title: 'Traditional Solutions (All Terrible)',
          items: [
            '❌ <strong>Fly everyone to HQ:</strong> Budget nightmare, scheduling chaos, carbon footprint guilt',
            '❌ <strong>Hire local photographers:</strong> Inconsistent results, different lighting, backgrounds that don\'t match',
            '❌ <strong>Ask people to send their own photos:</strong> Hello, beach selfies and wedding crops next to your CFO\'s professional headshot',
            '❌ <strong>Skip it entirely:</strong> Anonymous avatars or no photos = "who are these people we\'re supposed to trust?"'
          ]
        },
        p4: 'This is exactly why AI corporate headshots exist. Not as a gimmick, but as the only practical solution for modern teams.'
      },
      costComparison: {
        title: 'The Real Cost Comparison (With Actual Numbers)',
        p1: 'Let\'s do the math for a 20-person team:',
        table: {
          headers: ['Cost Factor', 'Traditional Photography', `AI Headshots (${brandName})`],
          rows: [
            ['Per-person cost', '$200-350', '$3-10'],
            ['Coordination time (HR hours)', '10-20 hours', '1-2 hours'],
            ['Employee time', '2-4 hours each', '5-10 minutes each'],
            ['Travel/venue costs', '$500-5,000', '$0'],
            ['Turnaround time', '2-4 weeks', 'Same day'],
            ['Total for 20 people', '$5,000-12,000', '$60-200']
          ]
        },
        p2: 'And those numbers don\'t even capture the biggest cost: getting 20 busy people to show up at the same place at the same time. If you\'ve ever organized a team photo shoot, you know this is basically impossible.'
      },
      bestPractices: {
        title: 'Corporate AI Headshots Best Practices 2025',
        p1: 'Based on 2025 research and industry best practices, here\'s what works for corporate teams:',
        list: {
          title: '✅ 2025 Best Practices',
          items: [
            '• Use high-quality, sharp selfies as input for crisp results',
            '• Maintain consistency across all corporate channels (LinkedIn, email signatures, websites)',
            '• Ensure authenticity by keeping core facial features consistent',
            '• Match headshots to your corporate brand (attire, background, expression)',
            '• Test AI-generated headshots with HR or trusted colleagues before rollout',
            '• Choose tools with batch processing for team consistency'
          ]
        }
      },
      consistency: {
        title: 'The Consistency Problem (Why Most AI Tools Fail Teams)',
        p1: 'Here\'s where most AI headshot tools fall short for corporate use:',
        p2: 'They process each person individually. Person A gets a warm-toned office background. Person B gets cool lighting on a gray backdrop. Person C looks like they\'re standing in a different building entirely.',
        mismatchedBox: {
          title: 'The Mismatched Team Gallery',
          text1: 'You\'ve seen these company pages. It looks like they grabbed random LinkedIn profile photos from 15 different people (because that\'s exactly what they did).',
          text2: 'The signal this sends to visitors: "We\'re not actually a cohesive team. We just happen to share a Slack workspace."'
        },
        p3: 'For corporate headshots, consistency matters. Same background. Same lighting. Same professional style. Your team should look like a team.',
        consistencyBox: {
          title: 'What Consistency Looks Like',
          items: [
            '✅ Matching backgrounds across all team members',
            '✅ Consistent lighting and color temperature',
            '✅ Similar framing (headshots vs. half-body shots)',
            '✅ Complementary attire styles (even if not identical)',
            '✅ Brand-appropriate color schemes'
          ]
        }
      },
      implementation: {
        title: 'How to Implement AI Corporate Headshots (Step-by-Step)',
        p1: 'Here\'s the process that actually works for remote teams:',
        steps: [
          {
            title: 'Define Your Style Guide (15 minutes)',
            text: 'Before anyone uploads a selfie, decide:',
            list: ['Background: Solid color? Gradient? Office setting?', 'Attire: Business formal? Smart casual? Industry-specific?', 'Framing: Headshot only or chest-up?', 'Expression: Confident? Approachable? Industry-appropriate?']
          },
          {
            title: 'Choose Your AI Tool Wisely',
            text: `Look for tools designed for teams, not individuals. Key features: batch processing, consistent style application, and admin dashboard for review. ${brandName} was built specifically for this use case.`
          },
          {
            title: 'Send Team Invites (5 minutes)',
            text: 'Each team member gets a link to upload their selfie. They can do it from their phone in 2 minutes. No app downloads, no account creation required.'
          },
          {
            title: 'Team Members Upload Selfies (2-3 minutes each)',
            text: 'Guide them on what makes a good selfie:',
            list: ['Natural lighting (near a window works great)', 'Face the camera directly', 'Neutral background (doesn\'t need to be perfect)', 'No filters or heavy makeup']
          },
          {
            title: 'Review and Download (10 minutes)',
            text: 'Results appear in your admin dashboard. Review each headshot, request regenerations if needed, then download the complete set. Done.'
          }
        ]
      },
      cameraShy: {
        title: 'Handling the "I Hate Being Photographed" Team Members',
        p1: 'Every team has them. And honestly? AI headshots are actually easier for camera-shy people than traditional photography.',
        traditional: {
          title: 'Traditional Photo Shoot 😰',
          items: ['• Photographer watching them', '• Colleagues waiting for their turn', '• Pressure to "perform" on demand', '• Limited retakes (time pressure)', '• Seeing results weeks later']
        },
        ai: {
          title: 'AI Headshot 😌',
          items: ['• Take selfies in private', '• Take as many as they want', '• Choose their best one', '• See results immediately', '• Request regenerations if needed']
        },
        p2: 'The self-service nature of AI headshots actually reduces photo anxiety. People feel more in control, and that usually leads to better results.'
      },
      objections: {
        title: 'Addressing the Skeptics (Common Objections)',
        items: [
          { title: '"AI photos look fake"', text: 'Bad AI photos look fake. Good AI photos look like professional photography, because they use the same principles: proper lighting, clean backgrounds, and natural poses. The technology has improved dramatically in the past 2 years.' },
          { title: '"It won\'t look professional enough for our brand"', text: 'Would you say the same about professional retouching? AI headshots do what photographers have always done: optimize lighting, clean up backgrounds, and present people in their best professional light. The output is indistinguishable.' },
          { title: '"Our leadership won\'t approve this"', text: 'Show them the cost comparison. Traditional photography for a 20-person team: $5,000-12,000. AI headshots: $60-200. Plus faster turnaround and no scheduling chaos. The ROI case practically makes itself.' },
          { title: '"What about data privacy?"', text: `Valid concern. Choose AI tools with clear privacy policies. ${brandName} uses enterprise-grade encryption, doesn't train on your photos, and automatically deletes data after 30 days. Photos stay your property.` }
        ]
      },
      traditionalSense: {
        title: 'When Traditional Photography Still Makes Sense',
        p1: 'I\'m not going to pretend AI solves every use case. Traditional photography is still better for:',
        list: [
          '• <strong>C-suite executives</strong> who need premium, editorial-style portraits',
          '• <strong>Investor materials</strong> where perceived production value matters',
          '• <strong>Physical office imagery</strong> showing your actual space',
          '• <strong>Group photos</strong> (AI handles individuals, not group compositions)',
          '• <strong>Teams of 3-5 in the same location</strong> where logistics aren\'t an issue'
        ],
        p2: 'The hybrid approach works well: traditional photography for executives and marketing materials, AI headshots for the broader team. Best of both worlds.'
      }
    },
    faqTitle: 'Frequently Asked Questions',
    cta: {
      title: 'Ready to upgrade your team\'s professional image?',
      description: 'Get consistent, professional headshots for your entire team in one day. No photographers, no scheduling drama.',
      button: `Try ${brandName} for Teams →`
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
        question: '¿Cuánto cuestan los headshots corporativos AI comparados con un fotógrafo?',
        answer: `La fotografía corporativa tradicional cuesta $200-500 por persona, más tiempo de coordinación, viaje y maquillaje. Los headshots AI cuestan $15-50 por persona. Para un equipo de 10 personas, eso es $2,000-5,000 vs. $150-500. ${brandName} ofrece precios para equipos comenzando en $49 para equipos pequeños.`,
      },
      {
        question: '¿Puede la IA producir headshots consistentes para todo un equipo?',
        answer: `Sí, pero solo con las herramientas adecuadas. La mayoría de los generadores de headshots AI procesan a las personas individualmente, lo que lleva a estilos desajustados. ${brandName} fue construido específicamente para la consistencia del equipo: mismos fondos, iluminación y estilo en todos los miembros del equipo.`,
      },
      {
        question: '¿Cómo coordinamos headshots AI para un equipo remoto?',
        answer: 'Envía a cada miembro del equipo un enlace para subir su selfie. Pueden hacerlo desde su teléfono en 2 minutos. Sin programación, sin viajes, sin coordinación de zonas horarias. Los resultados están listos en minutos, no semanas.',
      },
      {
        question: '¿Son los headshots corporativos AI lo suficientemente profesionales para nuestro sitio web?',
        answer: 'Con herramientas de IA de calidad, sí. La IA moderna produce resultados de calidad de estudio que son indistinguibles de la fotografía tradicional. La clave es elegir una herramienta diseñada para uso profesional, no filtros de consumo.',
      },
      {
        question: '¿Qué pasa con los empleados que son tímidos ante la cámara u odian las fotos?',
        answer: 'Los headshots AI son realmente más fáciles para las personas tímidas ante la cámara. Pueden tomar múltiples selfies en privado, elegir la que más les guste y dejar que la IA maneje el resto. Sin fotógrafo mirándolos, sin presión para actuar el día de la foto.',
      },
    ];
  }

  // English
  return [
    {
      question: 'How much do corporate AI headshots cost compared to a photographer?',
      answer: `Traditional corporate photography costs $200-500 per person, plus coordination time, travel, and makeup. AI headshots cost $15-50 per person. For a 10-person team, that's $2,000-5,000 vs. $150-500. ${brandName} offers team pricing starting at $49 for small teams.`,
    },
    {
      question: 'Can AI produce consistent headshots across an entire team?',
      answer: `Yes, but only with the right tools. Most AI headshot generators process people individually, leading to mismatched styles. ${brandName} was built specifically for team consistency: same backgrounds, lighting, and style across all team members.`,
    },
    {
      question: 'How do we coordinate AI headshots for a remote team?',
      answer: 'Send each team member a link to upload their selfie. They can do it from their phone in 2 minutes. No scheduling, no travel, no time zone coordination. Results are ready in minutes, not weeks.',
    },
    {
      question: 'Are AI corporate headshots professional enough for our website?',
      answer: 'With quality AI tools, yes. Modern AI produces studio-quality results that are indistinguishable from traditional photography. The key is choosing a tool designed for professional use, not consumer filters.',
    },
    {
      question: 'What about employees who are camera-shy or hate photos?',
      answer: 'AI headshots are actually easier for camera-shy people. They can take multiple selfies in private, choose the one they like best, and let AI handle the rest. No photographer watching them, no pressure to perform on photo day.',
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
      canonical: '/blog/corporate-ai-headshots',
      languages: {
        en: '/blog/corporate-ai-headshots',
        es: '/es/blog/corporate-ai-headshots',
      },
    },
  };
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function CorporateAIHeadshotsPage({ params }: Props) {
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
        url={`${baseUrl}${locale === 'es' ? '/es' : ''}/blog/corporate-ai-headshots`}
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
            <p>{content.author.title} · {locale === 'es' ? 'Actualizado Nov 2025' : 'Updated Nov 2025'}</p>
          </div>
        </div>

        <TldrSection>
          {content.tldr.map((item, index) => (
            <p key={index} dangerouslySetInnerHTML={{ __html: item }} />
          ))}
        </TldrSection>

        <BlogHeroImage
          slug="corporate-ai-headshots"
          alt="Remote team members viewing AI-generated professional headshots on laptops in modern office workspace"
          caption={{
            en: 'AI headshots provide consistent professional images for distributed teams',
            es: 'Los headshots AI proporcionan imágenes profesionales consistentes para equipos distribuidos'
          }}
          locale={locale}
        />

        {/* The Remote Team Headshot Problem */}
        <h2 id="the-problem" className="text-2xl font-bold mt-12 mb-4 text-gray-900">
          {content.sections.problem.title}
        </h2>

        <p className="mb-4 text-gray-700 leading-relaxed">
          {content.sections.problem.p1}
        </p>

        <p className="mb-4 text-gray-700 leading-relaxed">
          {content.sections.problem.p2}
        </p>

        <p className="mb-4 text-gray-700 leading-relaxed">
          {content.sections.problem.p3}
        </p>

        <div className="bg-gray-50 p-6 rounded-lg mb-6">
          <h3 className="font-semibold text-gray-900 mb-3">{content.sections.problem.solutions.title}</h3>
          <ul className="space-y-3 text-gray-700">
            {content.sections.problem.solutions.items.map((item, i) => (
              <li key={i} className="flex items-start gap-2" dangerouslySetInnerHTML={{ __html: item.replace('❌', '<span class="text-red-500 font-bold">❌</span><span>').replace(':', '</strong>') + '</span>' }} />
            ))}
          </ul>
        </div>

        <p className="mb-4 text-gray-700 leading-relaxed">
          {content.sections.problem.p4}
        </p>

        {/* Cost Comparison */}
        <h2 id="cost-comparison" className="text-2xl font-bold mt-12 mb-4 text-gray-900">
          {content.sections.costComparison.title}
        </h2>

        <p className="mb-4 text-gray-700 leading-relaxed">
          {content.sections.costComparison.p1}
        </p>

        <div className="overflow-x-auto mb-6">
          <table className="w-full border-collapse border border-gray-200">
            <thead>
              <tr className="bg-gray-50">
                {content.sections.costComparison.table.headers.map((header, i) => (
                  <th key={i} className="border border-gray-200 p-3 text-left font-semibold">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {content.sections.costComparison.table.rows.map((row, i) => (
                <tr key={i} className={i === content.sections.costComparison.table.rows.length - 1 ? 'bg-gray-50 font-semibold' : ''}>
                  {row.map((cell, j) => (
                    <td key={j} className={`border border-gray-200 p-3 ${j === 0 ? 'font-medium' : ''} ${i === content.sections.costComparison.table.rows.length - 1 && j === 1 ? 'text-red-600' : ''} ${i === content.sections.costComparison.table.rows.length - 1 && j === 2 ? 'text-green-600' : ''}`}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mb-4 text-gray-700 leading-relaxed">
          {content.sections.costComparison.p2}
        </p>

        {/* Best Practices Section */}
        <h2 id="best-practices" className="text-2xl font-bold mt-12 mb-4 text-gray-900">
          {content.sections.bestPractices.title}
        </h2>

        <p className="mb-4 text-gray-700 leading-relaxed">
          {content.sections.bestPractices.p1}
        </p>

        <div className="bg-green-50 p-6 rounded-lg mb-6">
          <h3 className="font-semibold text-green-900 mb-3">{content.sections.bestPractices.list.title}</h3>
          <ul className="space-y-2 text-green-800">
            {content.sections.bestPractices.list.items.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>

        {/* The Consistency Problem */}
        <h2 id="consistency" className="text-2xl font-bold mt-12 mb-4 text-gray-900">
          {content.sections.consistency.title}
        </h2>

        <p className="mb-4 text-gray-700 leading-relaxed">
          {content.sections.consistency.p1}
        </p>

        <p className="mb-4 text-gray-700 leading-relaxed">
          {content.sections.consistency.p2}
        </p>

        <div className="bg-red-50 p-6 rounded-lg mb-6">
          <h3 className="font-semibold text-red-900 mb-3">{content.sections.consistency.mismatchedBox.title}</h3>
          <p className="text-red-800 mb-4">
            {content.sections.consistency.mismatchedBox.text1}
          </p>
          <p className="text-red-800">
            {content.sections.consistency.mismatchedBox.text2}
          </p>
        </div>

        <p className="mb-4 text-gray-700 leading-relaxed">
          {content.sections.consistency.p3}
        </p>

        <div className="bg-green-50 p-6 rounded-lg mb-6">
          <h3 className="font-semibold text-green-900 mb-3">{content.sections.consistency.consistencyBox.title}</h3>
          <ul className="space-y-2 text-green-800">
            {content.sections.consistency.consistencyBox.items.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>

        {/* Implementation Steps */}
        <h2 id="implementation" className="text-2xl font-bold mt-12 mb-4 text-gray-900">
          {content.sections.implementation.title}
        </h2>

        <p className="mb-4 text-gray-700 leading-relaxed">
          {content.sections.implementation.p1}
        </p>

        <div className="space-y-6 mb-6">
          {content.sections.implementation.steps.map((step, i) => (
            <div key={i} className="flex gap-4 items-start">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold flex-shrink-0">
                {i + 1}
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">{step.title}</h3>
                <p className="text-gray-700 mb-2">
                  {step.text}
                </p>
                {step.list && (
                  <ul className="list-disc list-inside text-gray-700 text-sm space-y-1">
                    {step.list.map((item, j) => (
                      <li key={j}>{item}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Tips for Camera-Shy Team Members */}
        <h2 id="camera-shy" className="text-2xl font-bold mt-12 mb-4 text-gray-900">
          {content.sections.cameraShy.title}
        </h2>

        <p className="mb-4 text-gray-700 leading-relaxed">
          {content.sections.cameraShy.p1}
        </p>

        <div className="grid md:grid-cols-2 gap-4 mb-6">
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-semibold text-gray-900 mb-2">{content.sections.cameraShy.traditional.title}</h3>
            <ul className="space-y-1 text-gray-700 text-sm">
              {content.sections.cameraShy.traditional.items.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <h3 className="font-semibold text-green-900 mb-2">{content.sections.cameraShy.ai.title}</h3>
            <ul className="space-y-1 text-green-800 text-sm">
              {content.sections.cameraShy.ai.items.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>
        </div>

        <p className="mb-4 text-gray-700 leading-relaxed">
          {content.sections.cameraShy.p2}
        </p>

        {/* Common Objections */}
        <h2 id="objections" className="text-2xl font-bold mt-12 mb-4 text-gray-900">
          {content.sections.objections.title}
        </h2>

        <div className="space-y-6 mb-6">
          {content.sections.objections.items.map((item, i) => (
            <div key={i} className="border-l-4 border-gray-300 pl-4">
              <h3 className="font-semibold text-gray-900 mb-2">{item.title}</h3>
              <p className="text-gray-700">{item.text}</p>
            </div>
          ))}
        </div>

        {/* When Traditional Still Makes Sense */}
        <h2 id="when-traditional" className="text-2xl font-bold mt-12 mb-4 text-gray-900">
          {content.sections.traditionalSense.title}
        </h2>

        <p className="mb-4 text-gray-700 leading-relaxed">
          {content.sections.traditionalSense.p1}
        </p>

        <div className="bg-amber-50 p-6 rounded-lg mb-6">
          <ul className="space-y-2 text-amber-800">
            {content.sections.traditionalSense.list.map((item, i) => (
              <li key={i} dangerouslySetInnerHTML={{ __html: item }} />
            ))}
          </ul>
        </div>

        <p className="mb-4 text-gray-700 leading-relaxed">
          {content.sections.traditionalSense.p2}
        </p>

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
