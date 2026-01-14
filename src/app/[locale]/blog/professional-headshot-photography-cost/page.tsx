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
      title: '¿Cuánto Cuestan los Headshots Profesionales en 2025? (Guía de Precios)',
      description: 'Guía completa de precios de fotografía de headshots profesionales para 2025. Desde sesiones individuales ($100-500) hasta grupos corporativos ($30-75/persona). Compara con alternativas AI.',
      breadcrumb: 'Costos de Headshots Profesionales',
      tldr: [
        '<strong>Sesiones individuales:</strong> $150-500 para sesiones básicas, $500-1,500+ para fotógrafos premium. Incluye tiempo de sesión y 1-20 fotos editadas.',
        '<strong>Precios para grupos:</strong> Los descuentos por volumen reducen significativamente los costos: $75-150/persona para grupos pequeños, hasta $30-60/persona para equipos de 50+.',
        `<strong>Alternativa AI:</strong> ${brandName} ofrece headshots profesionales por $3-10/persona con resultados en minutos, no semanas.`
      ],
      sections: {
        intro: {
          title: '¿Cuánto Cuesta un Headshot Profesional?',
          p1: 'Las sesiones de fotos profesionales para headshots típicamente cuestan entre $150-500 para una sesión básica, aunque los precios varían considerablemente dependiendo de varios factores.',
          p2: 'Esta guía desglosa exactamente lo que puedes esperar pagar en 2025, ya sea para una foto profesional individual o para equipar a todo tu equipo con headshots consistentes. ¿Buscas <Link href="/es/blog/corporate-ai-headshots" className="text-brand-primary hover:underline">precios corporativos para equipos</Link>? También cubrimos eso.'
        },
        individualPricing: {
          title: 'Precios de Headshots Individuales 2025',
          p1: 'Esto es lo que puedes esperar pagar por un solo headshot profesional:',
          table: {
            headers: ['Nivel', 'Rango de Precio', 'Qué Incluye'],
            rows: [
              ['Básico/Principiante', '$100-200', 'Fotógrafos nuevos, tiempo limitado, 1-3 fotos editadas'],
              ['Rango Medio', '$200-400', 'Fotógrafos experimentados, múltiples looks, retoque incluido'],
              ['Premium/Establecido', '$500-1,500+', 'Fotógrafos reconocidos, ubicaciones premium, retoque extensivo']
            ]
          },
          p2: 'Los precios también varían significativamente por ciudad. NYC y LA típicamente cuestan 40-60% más que mercados más pequeños.'
        },
        whatAffects: {
          title: 'Qué Afecta el Precio de un Headshot',
          items: [
            { title: 'Experiencia del Fotógrafo', text: 'Fotógrafos más establecidos con portafolios extensos cobran tarifas premium. Estás pagando por su ojo artístico, no solo tiempo con la cámara.' },
            { title: 'Duración de la Sesión', text: 'Una sesión de 30 minutos cuesta significativamente menos que 1-2 horas. Las sesiones más largas permiten más cambios de atuendo y variedad de poses.' },
            { title: 'Número de Fotos Finales', text: 'Los paquetes básicos podrían incluir 1-3 imágenes editadas, mientras que los paquetes premium ofrecen 10-20 o más. Cada foto adicional suma al costo.' },
            { title: 'Nivel de Retoque', text: 'Retoques básicos (ajustes de iluminación, corrección menor de piel) vs edición extensiva (suavizado de piel, remoción de imperfecciones, contouring) afectan el precio.' },
            { title: 'Ubicación', text: 'Sesiones en estudio tienen costos fijos. Las sesiones en locación añaden tiempo de viaje, configuración y posiblemente alquiler de lugar.' },
            { title: 'Derechos de Uso', text: 'Los headshots para uso personal cuestan menos que el licenciamiento comercial. Si tu empresa usará las fotos en publicidad, espera tarifas más altas.' }
          ]
        },
        whatsIncluded: {
          title: 'Lo Que Típicamente Está Incluido',
          p1: 'La mayoría de los paquetes de headshots incluyen:',
          list: [
            'Tiempo de sesión (30 minutos a 2 horas)',
            'Número establecido de imágenes finales editadas/retocadas',
            'Archivos en alta resolución para impresión y digital',
            'Pruebas digitales o galería para elegir tus favoritas',
            'Orientación básica de poses durante la sesión'
          ],
          notIncluded: {
            title: 'Típicamente No Incluido (Costo Extra)',
            items: [
              'Peinado y maquillaje profesional: $75-200+',
              'Cambios de atuendo adicionales más allá del paquete',
              'Fotos adicionales editadas más allá del paquete',
              'Entrega acelerada',
              'Licenciamiento comercial'
            ]
          }
        },
        groupPricing: {
          title: 'Precios de Headshots Grupales y Corporativos',
          p1: 'Para grupos, los fotógrafos típicamente ofrecen descuentos por volumen. El costo por persona baja significativamente a medida que aumenta el tamaño del grupo:',
          table: {
            headers: ['Tamaño del Grupo', 'Precio por Persona', 'Total Aproximado'],
            rows: [
              ['Pequeño (5-10 personas)', '$75-150', '$375-1,500'],
              ['Mediano (10-25 personas)', '$50-100', '$500-2,500'],
              ['Grande (25-50 personas)', '$40-75', '$1,000-3,750'],
              ['Muy grande (50+ personas)', '$30-60', '$1,500+']
            ]
          }
        },
        howGroupWorks: {
          title: 'Cómo Funcionan los Paquetes Grupales',
          p1: 'Los fotógrafos típicamente cobran de una de estas tres maneras:',
          methods: [
            { title: 'Tarifa por persona', text: 'Una tarifa fija por headshot con descuentos por volumen' },
            { title: 'Tarifa por día + por persona', text: 'Ej: $500-1,000 por el tiempo del fotógrafo, más $25-50 por persona' },
            { title: 'Tarifa por hora', text: '$150-300/hora, pudiendo fotografiar 8-15 personas por hora' }
          ],
          included: {
            title: 'Típicamente Incluido en Paquetes Corporativos',
            items: [
              'Sesión en sitio en tu oficina o ubicación elegida',
              '10-15 minutos por persona',
              '1-3 imágenes finales editadas por persona',
              'Retoque básico',
              'Entrega digital',
              'Configuración consistente de fondo e iluminación'
            ]
          }
        },
        realExample: {
          title: 'Ejemplo del Mundo Real: Equipo de 20 Personas',
          p1: 'Para un equipo de 20 personas, así es como se comparan los costos:',
          table: {
            headers: ['Factor de Costo', 'Fotografía Tradicional', `Headshots AI (${brandName})`],
            rows: [
              ['Costo por persona', '$50-100', '$3-10'],
              ['Tiempo de coordinación de RRHH', '10-20 horas', '1-2 horas'],
              ['Tiempo del empleado', '2-4 horas cada uno', '5-10 minutos cada uno'],
              ['Costos de viaje/lugar', '$500-2,000', '$0'],
              ['Tiempo de entrega', '2-4 semanas', 'Mismo día'],
              ['Total estimado', '$1,500-4,000', '$60-200']
            ]
          },
          p2: 'La diferencia de costo se vuelve aún más dramática cuando incluyes el tiempo perdido de productividad y la pesadilla logística de coordinar horarios.'
        },
        aiAlternative: {
          title: 'La Alternativa AI: 80-90% de Ahorro',
          p1: 'Los headshots AI han surgido como una alternativa legítima en 2025. La tecnología ha mejorado dramáticamente, produciendo resultados indistinguibles de la fotografía tradicional.',
          comparison: {
            traditional: {
              title: 'Fotografía Tradicional',
              pros: ['Valor de producción premium para ejecutivos', 'Físicamente "real" para quienes lo prefieren', 'Mejor para fotos grupales'],
              cons: ['Alto costo ($100-500+/persona)', 'Pesadilla de programación para equipos', 'Resultados inconsistentes con múltiples fotógrafos', 'Semanas de tiempo de entrega']
            },
            ai: {
              title: `Headshots AI (${brandName})`,
              pros: ['80-90% de ahorro en costos', 'Resultados en minutos, no semanas', 'Perfecta consistencia para equipos', 'Sin logística de programación'],
              cons: ['No para fotos grupales', 'Algunos ejecutivos prefieren fotografía tradicional']
            }
          },
          p2: 'Para la mayoría de casos de uso profesional, LinkedIn, firmas de email, páginas de equipo del sitio web, los headshots AI ofrecen mejor valor y resultados más rápidos.'
        },
        whenTraditional: {
          title: 'Cuándo la Fotografía Tradicional Sigue Teniendo Sentido',
          p1: 'La fotografía tradicional sigue siendo la mejor opción para:',
          list: [
            '<strong>Ejecutivos C-suite</strong> que necesitan retratos premium estilo editorial',
            '<strong>Materiales para inversores</strong> donde el valor de producción percibido importa',
            '<strong>Imágenes de oficina física</strong> mostrando tu espacio real',
            '<strong>Fotos grupales</strong> (la IA maneja individuos, no composiciones grupales)',
            '<strong>Equipos de 3-5 en la misma ubicación</strong> donde la logística no es un problema'
          ],
          p2: 'El enfoque híbrido funciona bien: fotografía tradicional para ejecutivos y materiales de marketing, headshots AI para el equipo general.'
        },
        tips: {
          title: 'Consejos para Obtener el Mejor Valor',
          items: [
            { title: 'Compara presupuestos', text: 'Contacta 3-4 fotógrafos locales para comparar paquetes y estilos. Mira sus portafolios para asegurar que su estilo coincida con lo que buscas.' },
            { title: 'Pregunta qué está incluido', text: 'Aclara exactamente cuántas imágenes finales obtienes, qué nivel de retoque está incluido, y si hay cargos adicionales.' },
            { title: 'Considera el timing', text: 'Algunos fotógrafos ofrecen descuentos para sesiones entre semana o durante temporadas más lentas.' },
            { title: 'Negocia para grupos', text: 'Si reservas para un equipo, no dudes en negociar. La mayoría de fotógrafos tienen flexibilidad en precios grupales.' },
            { title: 'Evalúa alternativas AI', text: `Para equipos remotos o con limitaciones de presupuesto, herramientas como ${brandName} ofrecen calidad profesional a una fracción del costo.` }
          ]
        },
        nearMe: {
          title: 'Por Qué No Necesitas Buscar "Headshots Cerca de Mí"',
          p1: 'Muchos profesionales buscan por defecto "headshots cerca de mí" asumiendo que un estudio local es su única opción. En 2025, la ubicación ya no es una limitación.',
          p2: `Con generadores de headshots AI como ${brandName}, el estudio viene a ti. No necesitas conducir por la ciudad, pagar estacionamiento o tomar tiempo libre del trabajo. Puedes generar <Link href="/es/blog/ai-headshots-for-linkedin" className="text-brand-primary hover:underline">headshots para LinkedIn</Link> profesionales desde tu sala, asegurando que obtengas la foto perfecta sin la molestia logística.`
        }
      },
      faqTitle: 'Preguntas Frecuentes',
      cta: {
        title: '¿Buscas headshots profesionales sin el alto precio?',
        description: `Obtén headshots de calidad de estudio para ti o todo tu equipo en minutos. ${brandName} ofrece resultados profesionales a partir de $3/persona.`,
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
    title: 'How Much Do Professional Headshots Cost in 2025? (Pricing Guide)',
    description: 'Complete professional headshot photography pricing guide for 2025. From individual sessions ($100-500) to corporate groups ($30-75/person). Compare with AI alternatives.',
    breadcrumb: 'Professional Headshot Cost',
    tldr: [
      '<strong>Individual sessions:</strong> $150-500 for basic sessions, $500-1,500+ for premium photographers. Includes session time and 1-20 edited photos.',
      '<strong>Group pricing:</strong> Volume discounts significantly reduce costs: $75-150/person for small groups, down to $30-60/person for 50+ teams.',
      `<strong>AI alternative:</strong> ${brandName} offers professional headshots for $3-10/person with results in minutes, not weeks.`
    ],
    sections: {
      intro: {
        title: 'How Much Does a Professional Headshot Cost?',
        p1: 'Professional headshot photoshoots typically cost between $150-500 for a basic session, though prices can vary quite a bit depending on several factors.',
        p2: 'This guide breaks down exactly what you can expect to pay in 2025, whether you need a single professional photo or need to outfit your entire team with consistent headshots. Looking for <Link href="/blog/corporate-ai-headshots" className="text-brand-primary hover:underline">corporate pricing for teams</Link>? We cover that too.'
      },
      individualPricing: {
        title: 'Individual Headshot Pricing 2025',
        p1: 'Here\'s what you can expect to pay for a single professional headshot:',
        table: {
          headers: ['Tier', 'Price Range', 'What\'s Included'],
          rows: [
            ['Budget/Entry-Level', '$100-200', 'Newer photographers, limited time, 1-3 edited photos'],
            ['Mid-Range', '$200-400', 'Experienced photographers, multiple looks, retouching included'],
            ['Premium/Established', '$500-1,500+', 'Established photographers, premium locations, extensive retouching']
          ]
        },
        p2: 'Prices also vary significantly by city. NYC and LA typically cost 40-60% more than smaller markets.'
      },
      whatAffects: {
        title: 'What Affects Headshot Pricing',
        items: [
          { title: 'Photographer Experience', text: 'More established photographers with extensive portfolios charge premium rates. You\'re paying for their artistic eye, not just camera time.' },
          { title: 'Session Length', text: 'A 30-minute session costs significantly less than 1-2 hours. Longer sessions allow for more outfit changes and pose variety.' },
          { title: 'Number of Final Images', text: 'Basic packages might include 1-3 edited images, while premium packages offer 10-20 or more. Each additional photo adds to the cost.' },
          { title: 'Retouching Level', text: 'Basic touchups (lighting adjustments, minor skin correction) vs extensive editing (skin smoothing, blemish removal, contouring) affect price.' },
          { title: 'Location', text: 'Studio sessions have fixed overhead. On-location shoots add travel time, setup, and potentially venue rental.' },
          { title: 'Usage Rights', text: 'Headshots for personal use cost less than commercial licensing. If your company will use the photos in advertising, expect higher rates.' }
        ]
      },
      whatsIncluded: {
        title: 'What\'s Typically Included',
        p1: 'Most headshot packages include:',
        list: [
          'Session time (30 minutes to 2 hours)',
          'Set number of edited/retouched final images',
          'High-resolution files for print and digital',
          'Digital proofs or gallery to choose your favorites',
          'Basic posing direction during the session'
        ],
        notIncluded: {
          title: 'Typically Not Included (Extra Cost)',
          items: [
            'Professional hair and makeup: $75-200+',
            'Additional outfit changes beyond package',
            'Extra edited photos beyond package',
            'Rush delivery',
            'Commercial licensing'
          ]
        }
      },
      groupPricing: {
        title: 'Group and Corporate Headshot Pricing',
        p1: 'For groups, photographers typically offer volume discounts. The per-person cost drops significantly as group size increases:',
        table: {
          headers: ['Group Size', 'Per-Person Price', 'Approximate Total'],
          rows: [
            ['Small (5-10 people)', '$75-150', '$375-1,500'],
            ['Medium (10-25 people)', '$50-100', '$500-2,500'],
            ['Large (25-50 people)', '$40-75', '$1,000-3,750'],
            ['Very Large (50+ people)', '$30-60', '$1,500+']
          ]
        }
      },
      howGroupWorks: {
        title: 'How Group Packages Work',
        p1: 'Photographers typically charge one of three ways:',
        methods: [
          { title: 'Per-person rate', text: 'A flat fee per headshot with volume discounts' },
          { title: 'Day rate + per-person fee', text: 'E.g., $500-1,000 for the photographer\'s time, plus $25-50 per person' },
          { title: 'Hourly rate', text: '$150-300/hour, and they can typically shoot 8-15 people per hour' }
        ],
        included: {
          title: 'Typically Included in Corporate Packages',
          items: [
            'On-site session at your office or chosen location',
            '10-15 minutes per person',
            '1-3 edited final images per person',
            'Basic retouching',
            'Digital delivery',
            'Consistent backdrop and lighting setup'
          ]
        }
      },
      realExample: {
        title: 'Real-World Example: 20-Person Team',
        p1: 'For a team of 20 people, here\'s how costs compare:',
        table: {
          headers: ['Cost Factor', 'Traditional Photography', `AI Headshots (${brandName})`],
          rows: [
            ['Per-person cost', '$50-100', '$3-10'],
            ['HR coordination time', '10-20 hours', '1-2 hours'],
            ['Employee time', '2-4 hours each', '5-10 minutes each'],
            ['Travel/venue costs', '$500-2,000', '$0'],
            ['Turnaround time', '2-4 weeks', 'Same day'],
            ['Estimated total', '$1,500-4,000', '$60-200']
          ]
        },
        p2: 'The cost difference becomes even more dramatic when you factor in lost productivity time and the logistical nightmare of coordinating schedules.'
      },
      aiAlternative: {
        title: 'The AI Alternative: 80-90% Savings',
        p1: 'AI headshots have emerged as a legitimate alternative in 2025. The technology has improved dramatically, producing results that are indistinguishable from traditional photography.',
        comparison: {
          traditional: {
            title: 'Traditional Photography',
            pros: ['Premium production value for executives', 'Physically "real" for those who prefer it', 'Better for group photos'],
            cons: ['High cost ($100-500+/person)', 'Scheduling nightmare for teams', 'Inconsistent results across multiple photographers', 'Weeks of turnaround time']
          },
          ai: {
            title: `AI Headshots (${brandName})`,
            pros: ['80-90% cost savings', 'Results in minutes, not weeks', 'Perfect consistency for teams', 'No scheduling logistics'],
            cons: ['Not for group photos', 'Some executives prefer traditional photography']
          }
        },
        p2: 'For most professional use cases—LinkedIn, email signatures, website team pages—AI headshots deliver better value and faster results.'
      },
      whenTraditional: {
        title: 'When Traditional Photography Still Makes Sense',
        p1: 'Traditional photography is still the best choice for:',
        list: [
          '<strong>C-suite executives</strong> who need premium, editorial-style portraits',
          '<strong>Investor materials</strong> where perceived production value matters',
          '<strong>Physical office imagery</strong> showing your actual space',
          '<strong>Group photos</strong> (AI handles individuals, not group compositions)',
          '<strong>Teams of 3-5 in the same location</strong> where logistics aren\'t an issue'
        ],
        p2: 'The hybrid approach works well: traditional photography for executives and marketing materials, AI headshots for the broader team.'
      },
      tips: {
        title: 'Tips for Getting the Best Value',
        items: [
          { title: 'Get multiple quotes', text: 'Reach out to 3-4 local photographers to compare packages and styles. Look at their portfolios to ensure their style matches what you\'re looking for.' },
          { title: 'Ask what\'s included', text: 'Clarify exactly how many final images you get, what level of retouching is included, and whether there are any additional charges.' },
          { title: 'Consider timing', text: 'Some photographers offer discounts for weekday sessions or during slower seasons.' },
          { title: 'Negotiate for groups', text: 'If you\'re booking for a team, don\'t hesitate to negotiate. Most photographers have flexibility on group pricing.' },
          { title: 'Evaluate AI alternatives', text: `For remote teams or budget-conscious situations, tools like ${brandName} offer professional quality at a fraction of the cost.` }
        ]
      },
      nearMe: {
        title: 'Why You Don\'t Need to Search for "Headshots Near Me"',
        p1: 'Many professionals default to searching for "headshots near me" assuming a local studio is their only option. In 2025, location is no longer a constraint.',
        p2: `With AI headshot generators like ${brandName}, the studio comes to you. You don't need to drive across town, pay for parking, or take time off work. You can generate professional <Link href="/blog/ai-headshots-for-linkedin" className="text-brand-primary hover:underline">LinkedIn headshots</Link> from your living room, ensuring you get the perfect shot without the logistical hassle.`
      }
    },
    faqTitle: 'Frequently Asked Questions',
    cta: {
      title: 'Looking for professional headshots without the premium price?',
      description: `Get studio-quality headshots for yourself or your entire team in minutes. ${brandName} delivers professional results starting at $3/person.`,
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
        question: '¿Cuánto cuesta un headshot profesional básico?',
        answer: 'Un headshot profesional básico típicamente cuesta $150-300 para una sesión de 30-60 minutos con 1-3 fotos editadas. Los fotógrafos de gama media cobran $200-400 con más fotos y mejor retoque. Los fotógrafos premium pueden cobrar $500-1,500+ por headshots de calidad editorial.',
      },
      {
        question: '¿Cuánto cuestan los headshots corporativos para grupos?',
        answer: `Los headshots corporativos grupales se benefician de descuentos por volumen. Espera $75-150/persona para grupos pequeños (5-10), $50-100/persona para grupos medianos (10-25), y $30-60/persona para equipos grandes (50+). Para un equipo de 20 personas, presupuesta $1,000-2,000 para fotografía tradicional o $60-200 para alternativas AI como ${brandName}.`,
      },
      {
        question: '¿Qué está incluido en un paquete típico de headshots?',
        answer: 'La mayoría de los paquetes incluyen tiempo de sesión (30min-2hrs), un número establecido de imágenes finales editadas, archivos en alta resolución y dirección básica de poses. Peinado/maquillaje, cambios de atuendo extra, y entrega express típicamente cuestan adicional. Los paquetes corporativos generalmente incluyen sesión en sitio y configuración consistente de fondo.',
      },
      {
        question: '¿Valen la pena los headshots AI comparados con la fotografía tradicional?',
        answer: `Para la mayoría de casos de uso profesional (LinkedIn, firmas de email, páginas de equipo), los headshots AI ofrecen mejor valor con 80-90% de ahorro en costos y resultados en minutos. La tecnología ha mejorado dramáticamente. La fotografía tradicional sigue siendo preferida para ejecutivos C-suite, materiales para inversores, y fotos grupales.`,
      },
      {
        question: '¿Cuánto tiempo toma obtener headshots profesionales?',
        answer: 'La fotografía tradicional típicamente toma 2-4 semanas desde la reserva hasta la entrega final. Las sesiones duran 30min-2hrs, seguidas por una semana o más para edición y retoque. Los headshots AI pueden entregarse el mismo día, típicamente en minutos después de subir una selfie.',
      },
      {
        question: '¿Debería contratar un fotógrafo o usar headshots AI para mi equipo?',
        answer: `Depende de tus prioridades. Usa fotografía tradicional para equipos pequeños co-ubicados (3-5 personas), cuando el presupuesto no es una preocupación, o para headshots de ejecutivos. Usa headshots AI para equipos remotos/distribuidos, equipos más grandes (10+), tiempos de entrega ajustados, o cuando la consistencia entre miembros del equipo es crítica. Muchas empresas usan un enfoque híbrido.`,
      },
    ];
  }

  // English
  return [
    {
      question: 'How much does a basic professional headshot cost?',
      answer: 'A basic professional headshot typically costs $150-300 for a 30-60 minute session with 1-3 edited photos. Mid-range photographers charge $200-400 with more photos and better retouching. Premium photographers may charge $500-1,500+ for editorial-quality headshots.',
    },
    {
      question: 'How much do corporate headshots cost for groups?',
      answer: `Corporate group headshots benefit from volume discounts. Expect $75-150/person for small groups (5-10), $50-100/person for medium groups (10-25), and $30-60/person for large teams (50+). For a 20-person team, budget $1,000-2,000 for traditional photography or $60-200 for AI alternatives like ${brandName}.`,
    },
    {
      question: 'What\'s included in a typical headshot package?',
      answer: 'Most packages include session time (30min-2hrs), a set number of edited final images, high-resolution files, and basic posing direction. Hair/makeup, extra outfit changes, and rush delivery typically cost extra. Corporate packages usually include on-site session and consistent backdrop setup.',
    },
    {
      question: 'Are AI headshots worth it compared to traditional photography?',
      answer: `For most professional use cases (LinkedIn, email signatures, team pages), AI headshots offer better value with 80-90% cost savings and same-day results. The technology has improved dramatically. Traditional photography is still preferred for C-suite executives, investor materials, and group photos.`,
    },
    {
      question: 'How long does it take to get professional headshots?',
      answer: 'Traditional photography typically takes 2-4 weeks from booking to final delivery. Sessions run 30min-2hrs, followed by a week or more for editing and retouching. AI headshots can be delivered same-day, typically within minutes after uploading a selfie.',
    },
    {
      question: 'Should I hire a photographer or use AI headshots for my team?',
      answer: `It depends on your priorities. Use traditional photography for small co-located teams (3-5 people), when budget isn't a concern, or for executive headshots. Use AI headshots for remote/distributed teams, larger teams (10+), tight turnaround times, or when consistency across team members is critical. Many companies use a hybrid approach.`,
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
      publishedTime: '2025-12-04',
      authors: ['Matthieu van Haperen'],
    },
    alternates: {
      canonical: '/blog/professional-headshot-photography-cost',
      languages: {
        en: '/blog/professional-headshot-photography-cost',
        es: '/es/blog/professional-headshot-photography-cost',
      },
    },
  };
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function ProfessionalHeadshotCostPage({ params }: Props) {
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
        datePublished="2025-12-04"
        url={`${baseUrl}${locale === 'es' ? '/es' : ''}/blog/professional-headshot-photography-cost`}
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
            <p>{content.author.title} · {locale === 'es' ? 'Actualizado Dic 2025' : 'Updated Dec 2025'}</p>
          </div>
        </div>

        <TldrSection>
          {content.tldr.map((item, index) => (
            <p key={index} dangerouslySetInnerHTML={{ __html: item }} />
          ))}
        </TldrSection>

        {/* Introduction */}
        <h2 id="intro" className="text-2xl font-bold mt-12 mb-4 text-gray-900">
          {content.sections.intro.title}
        </h2>
        <p className="mb-4 text-gray-700 leading-relaxed">
          {content.sections.intro.p1}
        </p>
        <p className="mb-4 text-gray-700 leading-relaxed">
          {content.sections.intro.p2}
        </p>

        {/* Individual Pricing */}
        <h2 id="individual-pricing" className="text-2xl font-bold mt-12 mb-4 text-gray-900">
          {content.sections.individualPricing.title}
        </h2>
        <p className="mb-4 text-gray-700 leading-relaxed">
          {content.sections.individualPricing.p1}
        </p>
        <div className="overflow-x-auto mb-6">
          <table className="w-full border-collapse border border-gray-200">
            <thead>
              <tr className="bg-gray-50">
                {content.sections.individualPricing.table.headers.map((header, i) => (
                  <th key={i} className="border border-gray-200 p-3 text-left font-semibold">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {content.sections.individualPricing.table.rows.map((row, i) => (
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
        <p className="mb-4 text-gray-700 leading-relaxed">
          {content.sections.individualPricing.p2}
        </p>

        {/* What Affects Price */}
        <h2 id="what-affects" className="text-2xl font-bold mt-12 mb-4 text-gray-900">
          {content.sections.whatAffects.title}
        </h2>
        <div className="space-y-6 mb-6">
          {content.sections.whatAffects.items.map((item, i) => (
            <div key={i} className="border-l-4 border-gray-300 pl-4">
              <h3 className="font-semibold text-gray-900 mb-2">{item.title}</h3>
              <p className="text-gray-700">{item.text}</p>
            </div>
          ))}
        </div>

        {/* What's Included */}
        <h2 id="whats-included" className="text-2xl font-bold mt-12 mb-4 text-gray-900">
          {content.sections.whatsIncluded.title}
        </h2>
        <p className="mb-4 text-gray-700 leading-relaxed">
          {content.sections.whatsIncluded.p1}
        </p>
        <div className="bg-green-50 p-6 rounded-lg mb-6">
          <ul className="space-y-2 text-green-800">
            {content.sections.whatsIncluded.list.map((item, i) => (
              <li key={i}>✅ {item}</li>
            ))}
          </ul>
        </div>
        <div className="bg-amber-50 p-6 rounded-lg mb-6">
          <h3 className="font-semibold text-amber-900 mb-3">{content.sections.whatsIncluded.notIncluded.title}</h3>
          <ul className="space-y-2 text-amber-800">
            {content.sections.whatsIncluded.notIncluded.items.map((item, i) => (
              <li key={i}>• {item}</li>
            ))}
          </ul>
        </div>

        {/* Group Pricing */}
        <h2 id="group-pricing" className="text-2xl font-bold mt-12 mb-4 text-gray-900">
          {content.sections.groupPricing.title}
        </h2>
        <p className="mb-4 text-gray-700 leading-relaxed">
          {content.sections.groupPricing.p1}
        </p>
        <div className="overflow-x-auto mb-6">
          <table className="w-full border-collapse border border-gray-200">
            <thead>
              <tr className="bg-gray-50">
                {content.sections.groupPricing.table.headers.map((header, i) => (
                  <th key={i} className="border border-gray-200 p-3 text-left font-semibold">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {content.sections.groupPricing.table.rows.map((row, i) => (
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

        {/* How Group Packages Work */}
        <h2 id="how-group-works" className="text-2xl font-bold mt-12 mb-4 text-gray-900">
          {content.sections.howGroupWorks.title}
        </h2>
        <p className="mb-4 text-gray-700 leading-relaxed">
          {content.sections.howGroupWorks.p1}
        </p>
        <div className="space-y-4 mb-6">
          {content.sections.howGroupWorks.methods.map((method, i) => (
            <div key={i} className="flex gap-4 items-start">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold flex-shrink-0">
                {i + 1}
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">{method.title}</h3>
                <p className="text-gray-700 text-sm">{method.text}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="bg-blue-50 p-6 rounded-lg mb-6">
          <h3 className="font-semibold text-blue-900 mb-3">{content.sections.howGroupWorks.included.title}</h3>
          <ul className="space-y-2 text-blue-800">
            {content.sections.howGroupWorks.included.items.map((item, i) => (
              <li key={i}>✅ {item}</li>
            ))}
          </ul>
        </div>

        {/* Real World Example */}
        <h2 id="real-example" className="text-2xl font-bold mt-12 mb-4 text-gray-900">
          {content.sections.realExample.title}
        </h2>
        <p className="mb-4 text-gray-700 leading-relaxed">
          {content.sections.realExample.p1}
        </p>
        <div className="overflow-x-auto mb-6">
          <table className="w-full border-collapse border border-gray-200">
            <thead>
              <tr className="bg-gray-50">
                {content.sections.realExample.table.headers.map((header, i) => (
                  <th key={i} className="border border-gray-200 p-3 text-left font-semibold">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {content.sections.realExample.table.rows.map((row, i) => (
                <tr key={i} className={i === content.sections.realExample.table.rows.length - 1 ? 'bg-gray-50 font-semibold' : ''}>
                  {row.map((cell, j) => (
                    <td key={j} className={`border border-gray-200 p-3 ${j === 0 ? 'font-medium' : ''} ${i === content.sections.realExample.table.rows.length - 1 && j === 1 ? 'text-red-600' : ''} ${i === content.sections.realExample.table.rows.length - 1 && j === 2 ? 'text-green-600' : ''}`}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mb-4 text-gray-700 leading-relaxed">
          {content.sections.realExample.p2}
        </p>

        {/* AI Alternative */}
        <h2 id="ai-alternative" className="text-2xl font-bold mt-12 mb-4 text-gray-900">
          {content.sections.aiAlternative.title}
        </h2>
        <p className="mb-4 text-gray-700 leading-relaxed">
          {content.sections.aiAlternative.p1}
        </p>
        <div className="grid md:grid-cols-2 gap-4 mb-6">
          <div className="bg-gray-50 p-5 rounded-lg">
            <h3 className="font-semibold text-gray-900 mb-3">{content.sections.aiAlternative.comparison.traditional.title}</h3>
            <div className="mb-3">
              <p className="text-xs text-gray-500 mb-1 uppercase tracking-wide">Pros</p>
              <ul className="space-y-1 text-sm text-gray-700">
                {content.sections.aiAlternative.comparison.traditional.pros.map((item, i) => (
                  <li key={i}>✅ {item}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1 uppercase tracking-wide">Cons</p>
              <ul className="space-y-1 text-sm text-gray-700">
                {content.sections.aiAlternative.comparison.traditional.cons.map((item, i) => (
                  <li key={i}>❌ {item}</li>
                ))}
              </ul>
            </div>
          </div>
          <div className="bg-green-50 p-5 rounded-lg">
            <h3 className="font-semibold text-green-900 mb-3">{content.sections.aiAlternative.comparison.ai.title}</h3>
            <div className="mb-3">
              <p className="text-xs text-green-600 mb-1 uppercase tracking-wide">Pros</p>
              <ul className="space-y-1 text-sm text-green-800">
                {content.sections.aiAlternative.comparison.ai.pros.map((item, i) => (
                  <li key={i}>✅ {item}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs text-green-600 mb-1 uppercase tracking-wide">Cons</p>
              <ul className="space-y-1 text-sm text-green-800">
                {content.sections.aiAlternative.comparison.ai.cons.map((item, i) => (
                  <li key={i}>⚠️ {item}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
        <p className="mb-4 text-gray-700 leading-relaxed">
          {content.sections.aiAlternative.p2}
        </p>

        {/* When Traditional Makes Sense */}
        <h2 id="when-traditional" className="text-2xl font-bold mt-12 mb-4 text-gray-900">
          {content.sections.whenTraditional.title}
        </h2>
        <p className="mb-4 text-gray-700 leading-relaxed">
          {content.sections.whenTraditional.p1}
        </p>
        <div className="bg-amber-50 p-6 rounded-lg mb-6">
          <ul className="space-y-2 text-amber-800">
            {content.sections.whenTraditional.list.map((item, i) => (
              <li key={i} dangerouslySetInnerHTML={{ __html: item }} />
            ))}
          </ul>
        </div>
        <p className="mb-4 text-gray-700 leading-relaxed">
          {content.sections.whenTraditional.p2}
        </p>

        {/* Tips for Best Value */}
        <h2 id="tips" className="text-2xl font-bold mt-12 mb-4 text-gray-900">
          {content.sections.tips.title}
        </h2>
        <div className="space-y-6 mb-6">
          {content.sections.tips.items.map((item, i) => (
            <div key={i} className="flex gap-4 items-start">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold flex-shrink-0">
                {i + 1}
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">{item.title}</h3>
                <p className="text-gray-700">{item.text}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Near Me Section */}
        <h2 id="near-me" className="text-2xl font-bold mt-12 mb-4 text-gray-900">
          {content.sections.nearMe.title}
        </h2>
        <p className="mb-4 text-gray-700 leading-relaxed">
          {content.sections.nearMe.p1}
        </p>
        <p className="mb-4 text-gray-700 leading-relaxed">
          {content.sections.nearMe.p2}
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

