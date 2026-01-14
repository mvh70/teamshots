
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
      title: 'La integración remota está rota: Cómo solucionar el problema de la foto del "nuevo contratado"',
      description: 'Guía para resolver los problemas con las fotos de nuevos empleados en equipos remotos. Optimiza tu proceso de onboarding con soluciones eficientes y escalables.',
      breadcrumb: 'Integración Remota Rota',
      tldr: [
        '<strong>El problema:</strong> Coordinar fotos para nuevos empleados remotos es un caos que roba tiempo.',
        '<strong>El efecto Frankenstein:</strong> Páginas de equipo inconsistentes dañan la imagen profesional de tu empresa.',
        '<strong>La solución con IA:</strong> Automatiza todo para headshots uniformes en minutos, no en semanas.'
      ],
      sections: {
        problem: {
          title: 'La integración remota está rota: Cómo solucionar el problema de la foto del "nuevo contratado"',
          p1: 'Seamos sinceros: nadie entra en RRHH o People Ops por una pasión ardiente por coordinar headshots.',
          p2: 'Es esa tarea que siempre queda al fondo de la lista, mirándote fijamente. Sabes cómo funciona en el "mundo antiguo": reservas al fotógrafo, bloqueas la sala de reuniones y pasas tres días suplicando a adultos que les importe.',
          p3: 'Yo he pasado por eso. Recuerdo estar en un pasillo con un portapapeles, sintiéndome menos líder y más como un supervisor de excursión escolar. Ves a tus mejores desarrolladores inquietos, esperando su turno, mientras sientes la frustración colectiva de un equipo que solo quiere volver al trabajo.',
          p4: 'Pero al menos entonces, todos estaban en el mismo edificio.',
          p5: 'Hoy lidias con algo muy diferente. Has armado un proceso de onboarding remoto impecable: envías la laptop a tiempo, programas el Zoom de bienvenida y mandas la caja de swag con la sudadera de marca.',
          p6: 'Pero hay un hueco enorme en tu checklist: la foto.',
          p7: 'Cuando tu nuevo líder de marketing está en Londres y el CTO en San Francisco, el "día de fotos" no es solo molesto: es imposible.',
          p8: '¿Qué pasa entonces? Lo dejas pasar. Le dices al nuevo: "Envíanos algo decente cuando puedas".'
        },
        frankenstein: {
          title: 'El efecto "Frankenstein" (Y por qué los candidatos lo notan)',
          p1: 'Como no puedes volar a un fotógrafo a casa de cada nuevo empleado, terminas con lo que llamo la página de equipo "Frankenstein".',
          p2: 'Es una mezcla desastrosa de tomas de estudio en alta resolución de 2019, fotos de bodas recortadas (donde aún se ve el hombro del novio) y selfies granulosos de webcam.',
          p3: 'Para ti, puede parecer solo una molestia cosmética. Pero para un candidato potencial, es una señal de alerta.',
          p4: 'El talento de élite crea una historia sobre tu empresa antes de postular. Miran tu página "Sobre nosotros" para ver con quién trabajarán.',
          p5: 'La uniformidad habla de cultura. Dice: "Somos un equipo cohesionado. Prestamos atención a los detalles".',
          p6: 'El caos habla de desconexión. Susurra: "Somos solo un grupo de freelancers trabajando por separado".',
          p7: 'Has trabajado duro en la cultura de tu empresa para dejar que una cuadrícula desordenada de JPEGs la socave. Pero hasta hace poco, estabas entre dos malas opciones: gastar miles de dólares contratando fotógrafos en cinco ciudades distintas, o aceptar el desastre.'
        },
        invoice: {
          title: 'La Factura que Nunca Ves',
          p1: 'El costo real de tratar de arreglar esto de la manera "tradicional" no es solo la tarifa del fotógrafo. Es la quema administrativa.',
          p2: 'Piensa en la fricción de onboarding. Ya estás lidiando con la inscripción de beneficios, configuración de TI y presentaciones de equipo. Agregar "Coordinar una sesión de fotos en Boise, Idaho" a tu plato es una pesadilla.',
          p3: 'Tienes que encontrar un proveedor local.',
          p4: 'Tienes que negociar tarifas.',
          p5: 'Tienes que perseguir la factura.',
          p6: 'Tienes que esperar que su estilo coincida con las fotos que tomaste en Nueva York hace tres años.',
          p7: 'Es un agujero negro logístico. Y francamente, como líder de People Ops, tu tiempo es demasiado valioso para eso. Deberías enfocarte en retención y cultura, no en iluminación y programación.'
        },
        pivot: {
          title: 'El giro: Branding asíncrono automatizado',
          p1: 'Tenemos que dejar de fingir que la forma antigua funciona en el mundo nuevo. Necesitamos una manera de parecer un equipo unificado sin actuar como un ejército regimentado.',
          p2: 'Aquí es donde la IA cambia las reglas del juego para RRHH.',
          p3: `No hablo de esos avatares caricaturescos que invadieron las redes sociales el año pasado. La tecnología ha madurado. Herramientas como ${brandName} han convertido el proceso de headshot en un flujo de trabajo escalable, no en un proyecto artístico.`,
          p4: 'Te permite separar la imagen de la ubicación.',
          p5: 'Aquí está el trade-off que necesitas evaluar:',
          p6: 'Opción A (La forma antigua): Obtienes fotos 100% "auténticas", pero la mitad están borrosas, la iluminación no coincide y toma 3 semanas coordinar por contratación.',
          p7: 'Opción B (La forma con IA): Obtienes una réplica 95% perfecta que es nítida, perfectamente iluminada, totalmente uniforme y toma 20 minutos ejecutar.',
          p8: 'Para un equipo de People Ops escalando una empresa, la consistencia supera a la perfección cada vez.'
        },
        checklist: {
          title: 'La nueva checklist de onboarding',
          p1: 'Imagina este flujo de trabajo en su lugar:',
          p2: 'Contratas a un nuevo empleado remoto.',
          p3: `Le envías un email de bienvenida con un enlace a ${brandName}.`,
          p4: 'Sube unas cuantas selfies desde su teléfono (le toma 2 minutos).',
          p5: 'Para cuando inicia sesión en Slack por primera vez, un headshot profesional alineado con la marca está listo para su perfil.',
          p6: 'Sin programar. Sin facturas. Sin "días de cabello malo".',
          p7: 'Tienes control total de la marca: eliges el fondo, el estilo de vestimenta y la iluminación, sin pedirle a un empleado que se cambie la camisa.'
        },
        faq: {
          title: 'Preguntas frecuentes',
          items: [
            {
              question: '¿Cuánto trabajo requiere realmente esto de mi parte?',
              answer: 'Casi nada. Ese es el punto. No programas citas ni reservas salas. Solo incluyes el enlace en tu checklist de onboarding. El sistema se encarga del resto, convirtiendo un proyecto de varios días en una tarea de "configúralo y olvídalo".'
            },
            {
              question: 'Mi equipo es... no muy bueno tomando fotos. ¿Funcionará aún?',
              answer: 'Sí. Construimos el sistema asumiendo que la mayoría de la gente es mala tomando selfies. La IA está diseñada para reconstruir iluminación y postura. Mientras la cara sea visible, la tecnología cierra la brecha entre un "selfie en el auto" y un "retrato de estudio".'
            },
            {
              question: '¿Es seguro para los datos de empleados?',
              answer: 'Tomamos la privacidad muy en serio. A diferencia de apps virales de consumo, somos una herramienta empresarial. Las imágenes se procesan de manera segura y no usamos los datos de tus empleados para entrenar modelos públicos.'
            },
            {
              question: '¿Se ve "humano"?',
              answer: 'El "valle inquietante" es cosa del pasado. Nuestra tecnología está calibrada para realismo profesional, manteniendo la esencia de la persona mientras mejora la presentación. Se ve como ellos, en su mejor día.'
            }
          ]
        },
        tuesday: {
          title: 'Recupera tu martes',
          p1: 'Si trabajas en RRHH, ya tienes suficiente en tu plato. Estás mediando conflictos, planeando retiros y construyendo el futuro del trabajo. No necesitas ser un productor de fotografía a tiempo parcial.',
          p2: 'Es hora de dejar atrás la idea de que una empresa "real" necesita una sesión de fotos física. Eso es mentalidad del pasado. El equipo de People moderno valora la eficiencia, la inclusión y la consistencia.',
          p3: 'Así que, cancela al fotógrafo. Borra la hoja de cálculo.',
          p4: 'Dale a tus nuevos contratados una bienvenida de clase mundial y regálate a ti mismo el tiempo que mereces.'
        }
      },
      faqTitle: 'Preguntas frecuentes',
      author: {
        title: `Fundador, ${brandName}`,
        bio: `Matthieu van Haperen es el fundador de ${brandName} y un ex venture builder con más de 6 años de experiencia en startups. Escribe sobre herramientas de IA, productividad y construcción en público.`
      },
      cta: {
        title: '¿Listo para mejorar la imagen profesional de tu equipo?',
        description: 'Obtén headshots consistentes y profesionales para todo tu equipo en un día. Descuentos por volumen disponibles para equipos grandes.',
        button: `Ver Precios para Equipos →`
      }
    };
  }

  // English content (use the provided content structured similarly)
  return {
    title: 'Remote Onboarding is Broken: How to Fix the "New Hire" Photo Problem',
    description: 'Guide to solving new employee photo problems in remote teams. Improve your onboarding process with efficient, scalable solutions.',
    breadcrumb: 'Remote Onboarding Broken',
    tldr: [
      '<strong>The Problem:</strong> Coordinating photos for remote new hires is chaotic and time-consuming.',
      '<strong>The Frankenstein Effect:</strong> Inconsistent team pages damage professional company image.',
      '<strong>The AI Solution:</strong> Automate the process for consistent headshots in minutes, not weeks.'
    ],
    sections: {
      problem: {
        title: 'Remote Onboarding is Broken: How to Fix the "New Hire" Photo Problem',
        p1: 'Let’s be honest: nobody gets into HR or People Ops because they have a burning passion for coordinating headshots.',
        p2: 'It’s the task that always sits at the bottom of the to-do list, staring at you. You know exactly how it goes in the "old world." You book the photographer, you block out the conference room, and then you spend the next three days begging grown adults to care about it.',
        p3: 'I’ve been there. I remember standing in a hallway with a clipboard, feeling less like a leader and more like a school chaperone. You watch your best developers awkwardly shuffling their feet, waiting for their turn. You feel the collective annoyance of a team that just wants to get back to work.',
        p4: 'But at least back then, everyone was in the building.',
        p5: 'Today, you’re dealing with a different beast. You’ve built an incredible remote onboarding process. You ship the laptop on time. You schedule the welcome Zoom. You send the swag box with the branded hoodie.',
        p6: 'But there is one gaping hole in your checklist: The Photo.',
        p7: 'When your new Marketing Lead is in London and your new CTO is in San Francisco, "Photo Day" isn\'t just annoying—it’s impossible.',
        p8: 'So, what happens? You let it slide. You tell the new hire, "Just send us something decent when you have a chance."'
      },
      frankenstein: {
        title: 'The "Frankenstein" Effect (And Why Candidates Notice)',
        p1: 'Because you can\'t fly a photographer to every new employee\'s house, you end up with what I call the "Frankenstein" Team Page.',
        p2: 'It’s a chaotic mix of high-res studio shots from 2019, cropped wedding photos (where you can still see the groom’s shoulder), and grainy webcam selfies.',
        p3: 'To you, it might just seem like a cosmetic annoyance. But to a prospective candidate, it’s a red flag.',
        p4: 'Top talent creates a narrative about your company before they even apply. They look at your "About Us" page to see who they’ll be working with.',
        p5: 'Uniformity signals culture. It says, "We are a cohesive unit. We take care of the details."',
        p6: 'Chaos signals disconnection. It whispers, "We are just a bunch of freelancers working in silos."',
        p7: 'You’ve worked too hard on your company culture to let a messy grid of JPEGs undermine it. But until recently, you were stuck between two bad options: burn thousands of dollars hiring photographers in five different cities, or accept the mess.'
      },
      invoice: {
        title: 'The Invoice You Never See',
        p1: 'The real cost of trying to fix this the "traditional" way isn\'t just the photographer\'s fee. It’s the administrative burn.',
        p2: 'Think about the onboarding friction. You are already juggling benefits enrollment, IT setup, and team intros. Adding "Coordinate a photoshoot in Boise, Idaho" to your plate is a nightmare.',
        p3: 'You have to find a local vendor.',
        p4: 'You have to negotiate rates.',
        p5: 'You have to chase the invoice.',
        p6: 'You have to hope their style matches the photos you took in New York three years ago.',
        p7: 'It is a logistical black hole. And frankly, as a People Ops leader, your time is too valuable for that. You should be focusing on retention and culture, not lighting and scheduling.'
      },
      pivot: {
        title: 'The Pivot: Automated Asynchronous Branding',
        p1: 'We have to stop pretending that the old way works for the new world. We need a way to look like a unified team without acting like a regimented army.',
        p2: 'This is where AI changes the game for HR.',
        p3: `I'm not talking about those cartoonish avatars that took over social media last year. The technology has matured. Tools like ${brandName} have turned the headshot process into a scalable workflow, not an artistic project.`,
        p4: 'It allows you to separate the image from the location.',
        p5: 'Here is the trade-off you need to weigh:',
        p6: 'Option A (The Old Way): You get 100% "authentic" photos, but half of them are blurry, the lighting is mismatched, and it takes 3 weeks to coordinate per hire.',
        p7: 'Option B (The AI Way): You get a 95% perfect replica that is crisp, perfectly lit, fully uniform, and takes 20 minutes to execute.',
        p8: 'For a People Ops team scaling a company, consistency beats perfection every time.'
      },
      checklist: {
        title: 'The New Onboarding Checklist',
        p1: 'Imagine this workflow instead:',
        p2: 'You hire a new remote employee.',
        p3: `You send them a welcome email with a ${brandName} link.`,
        p4: 'They upload a few selfies from their phone (takes them 2 minutes).',
        p5: 'By the time they log into Slack for the first time, a professional, brand-aligned headshot is ready for their profile.',
        p6: 'No scheduling. No invoices. No "bad hair days."',
        p7: 'You get total brand control—choosing the background, the attire style, and the lighting—without ever having to ask an employee to change their shirt.'
      },
      faq: {
        title: 'Frequently Asked Questions',
        items: [
          {
            question: 'How much work does this actually require from my end?',
            answer: 'Almost zero. That’s the point. You don\'t schedule slots or book rooms. You just include the link in your onboarding checklist. The system handles the rest, turning a multi-day project into a "set it and forget it" task.'
          },
          {
            question: 'My team is... not great at taking photos. Will this still work?',
            answer: 'Yes. We built the system assuming that most people are bad at taking selfies. The AI is designed to reconstruct lighting and posture. As long as the face is visible, the technology bridges the gap between a "car selfie" and a "studio portrait."'
          },
          {
            question: 'Is it secure for employee data?',
            answer: 'We take privacy seriously. Unlike viral consumer apps, we are an enterprise tool. Images are processed securely, and we don\'t use your employee data to train public models.'
          },
          {
            question: 'Does it look "human"?',
            answer: 'The "uncanny valley" is a thing of the past. Our technology is tuned for professional realism, keeping the essence of the person while polishing the presentation. It looks like them—on their best day.'
          }
        ]
      },
      tuesday: {
        title: 'Get Your Tuesday Back',
        p1: 'If you work in HR, you have enough on your plate. You are mediating conflicts, planning retreats, and building the future of work. You do not need to be a part-time photography producer.',
        p2: 'It’s time to let go of the idea that a "real" company needs a physical photo shoot. That is a legacy mindset. The modern People team values efficiency, inclusivity, and consistency.',
        p3: 'So, cancel the photographer. Delete the spreadsheet.',
        p4: 'Give your new hires a world-class welcome, and give yourself the gift of time.'
      }
    },
    faqTitle: 'Frequently Asked Questions',
    author: {
      title: `Founder, ${brandName}`,
      bio: `Matthieu van Haperen is the founder of ${brandName} and a former venture builder with 6+ years of experience in startups. He writes about AI tools, productivity, and building in public.`
    },
    cta: {
      title: 'Ready to upgrade your team\'s professional image?',
      description: 'Get consistent, professional headshots for your entire team in one day. Volume discounts available for large teams.',
      button: `View Team Pricing →`
    }
  };
};

const getFaqItems = (locale: string, brandName: string) => {
  if (locale === 'es') {
    return [
      {
        question: '¿Cuánto trabajo requiere realmente esto de mi parte?',
        answer: 'Casi nada. Ese es el punto. No programas citas ni reservas salas. Solo incluyes el enlace en tu checklist de onboarding. El sistema se encarga del resto, convirtiendo un proyecto de varios días en una tarea de "configúralo y olvídalo".'
      },
      {
        question: '¿Puede la IA producir headshots consistentes para todo un equipo?',
        answer: `Sí, pero solo con las herramientas adecuadas. La mayoría de generadores de headshots con IA procesan a las personas individualmente, lo que lleva a estilos dispares. ${brandName} está construido específicamente para la consistencia del equipo: mismos fondos, iluminación y estilo en todos los miembros.`
      },
      {
        question: '¿Cómo coordinamos headshots con IA para un equipo remoto?',
        answer: 'Envía a cada miembro del equipo un enlace para subir su selfie. Pueden hacerlo desde su teléfono en 2 minutos. Sin programar, sin viajar, sin coordinar zonas horarias. Los resultados están listos en minutos, no en semanas.'
      },
      {
        question: '¿Son los headshots con IA lo suficientemente profesionales para nuestro sitio web?',
        answer: 'Con herramientas de IA de calidad, sí. La IA moderna produce resultados de calidad de estudio que son indistinguibles de la fotografía tradicional. La clave es elegir una herramienta diseñada para uso profesional, no filtros de consumo.'
      },
      {
        question: '¿Qué hay de los empleados que son tímidos ante la cámara?',
        answer: 'Los headshots con IA son en realidad más fáciles para las personas tímidas. Pueden tomar múltiples selfies en privado, elegir la que más les guste y dejar que la IA se encargue del resto. Sin fotógrafo mirándolos, sin presión para actuar el día de la foto.'
      },
    ];
  }

  // English
  return [
    // Provided FAQ items
    {
      question: 'How much work does this actually require from my end?',
      answer: 'Almost zero. That’s the point. You don\'t schedule slots or book rooms. You just include the link in your onboarding checklist. The system handles the rest, turning a multi-day project into a "set it and forget it" task.'
    },
    // ... other items
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
      canonical: '/blog/remote-onboarding-broken',
      languages: {
        en: '/blog/remote-onboarding-broken',
        es: '/es/blog/remote-onboarding-broken',
      },
    },
  };
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function RemoteOnboardingBrokenPage({ params }: Props) {
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
        url={`${baseUrl}${locale === 'es' ? '/es' : ''}/blog/remote-onboarding-broken`}
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

        {/* The Remote Onboarding Problem */}
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

        <p className="mb-4 text-gray-700 leading-relaxed">
          {content.sections.problem.p4}
        </p>

        <p className="mb-4 text-gray-700 leading-relaxed">
          {content.sections.problem.p5}
        </p>

        <p className="mb-4 text-gray-700 leading-relaxed">
          {content.sections.problem.p6}
        </p>

        <p className="mb-4 text-gray-700 leading-relaxed">
          {content.sections.problem.p7}
        </p>

        <p className="mb-4 text-gray-700 leading-relaxed">
          {content.sections.problem.p8}
        </p>

        {/* The Frankenstein Effect */}
        <h2 id="frankenstein" className="text-2xl font-bold mt-12 mb-4 text-gray-900">
          {content.sections.frankenstein.title}
        </h2>

        <p className="mb-4 text-gray-700 leading-relaxed">
          {content.sections.frankenstein.p1}
        </p>

        <p className="mb-4 text-gray-700 leading-relaxed">
          {content.sections.frankenstein.p2}
        </p>

        <p className="mb-4 text-gray-700 leading-relaxed">
          {content.sections.frankenstein.p3}
        </p>

        <p className="mb-4 text-gray-700 leading-relaxed">
          {content.sections.frankenstein.p4}
        </p>

        <p className="mb-4 text-gray-700 leading-relaxed">
          {content.sections.frankenstein.p5}
        </p>

        <p className="mb-4 text-gray-700 leading-relaxed">
          {content.sections.frankenstein.p6}
        </p>

        <p className="mb-4 text-gray-700 leading-relaxed">
          {content.sections.frankenstein.p7}
        </p>

        {/* The Invoice You Never See */}
        <h2 id="invoice" className="text-2xl font-bold mt-12 mb-4 text-gray-900">
          {content.sections.invoice.title}
        </h2>

        <p className="mb-4 text-gray-700 leading-relaxed">
          {content.sections.invoice.p1}
        </p>

        <p className="mb-4 text-gray-700 leading-relaxed">
          {content.sections.invoice.p2}
        </p>

        <p className="mb-4 text-gray-700 leading-relaxed">
          {content.sections.invoice.p3}
        </p>

        <p className="mb-4 text-gray-700 leading-relaxed">
          {content.sections.invoice.p4}
        </p>

        <p className="mb-4 text-gray-700 leading-relaxed">
          {content.sections.invoice.p5}
        </p>

        <p className="mb-4 text-gray-700 leading-relaxed">
          {content.sections.invoice.p6}
        </p>

        <p className="mb-4 text-gray-700 leading-relaxed">
          {content.sections.invoice.p7}
        </p>

        {/* The Pivot */}
        <h2 id="pivot" className="text-2xl font-bold mt-12 mb-4 text-gray-900">
          {content.sections.pivot.title}
        </h2>

        <p className="mb-4 text-gray-700 leading-relaxed">
          {content.sections.pivot.p1}
        </p>

        <p className="mb-4 text-gray-700 leading-relaxed">
          {content.sections.pivot.p2}
        </p>

        <p className="mb-4 text-gray-700 leading-relaxed">
          {content.sections.pivot.p3}
        </p>

        <p className="mb-4 text-gray-700 leading-relaxed">
          {content.sections.pivot.p4}
        </p>

        <p className="mb-4 text-gray-700 leading-relaxed">
          {content.sections.pivot.p5}
        </p>

        <p className="mb-4 text-gray-700 leading-relaxed">
          {content.sections.pivot.p6}
        </p>

        <p className="mb-4 text-gray-700 leading-relaxed">
          {content.sections.pivot.p7}
        </p>

        <p className="mb-4 text-gray-700 leading-relaxed">
          {content.sections.pivot.p8}
        </p>

        {/* The New Onboarding Checklist */}
        <h2 id="checklist" className="text-2xl font-bold mt-12 mb-4 text-gray-900">
          {content.sections.checklist.title}
        </h2>

        <p className="mb-4 text-gray-700 leading-relaxed">
          {content.sections.checklist.p1}
        </p>

        <p className="mb-4 text-gray-700 leading-relaxed">
          {content.sections.checklist.p2}
        </p>

        <p className="mb-4 text-gray-700 leading-relaxed">
          {content.sections.checklist.p3}
        </p>

        <p className="mb-4 text-gray-700 leading-relaxed">
          {content.sections.checklist.p4}
        </p>

        <p className="mb-4 text-gray-700 leading-relaxed">
          {content.sections.checklist.p5}
        </p>

        <p className="mb-4 text-gray-700 leading-relaxed">
          {content.sections.checklist.p6}
        </p>

        <p className="mb-4 text-gray-700 leading-relaxed">
          {content.sections.checklist.p7}
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

        {/* Get Your Tuesday Back */}
        <h2 id="tuesday" className="text-2xl font-bold mt-16 mb-6 text-gray-900">
          {content.sections.tuesday.title}
        </h2>

        <p className="mb-4 text-gray-700 leading-relaxed">
          {content.sections.tuesday.p1}
        </p>

        <p className="mb-4 text-gray-700 leading-relaxed">
          {content.sections.tuesday.p2}
        </p>

        <p className="mb-4 text-gray-700 leading-relaxed">
          {content.sections.tuesday.p3}
        </p>

        <p className="mb-4 text-gray-700 leading-relaxed">
          {content.sections.tuesday.p4}
        </p>

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

