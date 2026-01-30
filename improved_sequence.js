const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, 
        AlignmentType, LevelFormat, HeadingLevel, 
        BorderStyle, WidthType, ShadingType, PageBreak } = require('docx');
const fs = require('fs');

const brandBlue = "1E3A5F";
const lightBlue = "E8F4FD";
const lightGray = "F9FAFB";

const cellBorder = { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" };
const cellBorders = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder };

function codeBlock(lines) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: [9360],
    rows: [
      new TableRow({
        children: [
          new TableCell({
            borders: cellBorders,
            shading: { fill: "F3F4F6", type: ShadingType.CLEAR },
            margins: { top: 150, bottom: 150, left: 200, right: 200 },
            children: lines.map(line => 
              new Paragraph({ 
                spacing: { after: 80 },
                children: [new TextRun({ text: line, font: "Courier New", size: 20 })] 
              })
            )
          })
        ]
      })
    ]
  });
}

function infoBox(title, content, color = lightBlue) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: [9360],
    rows: [
      new TableRow({
        children: [
          new TableCell({
            borders: cellBorders,
            shading: { fill: color, type: ShadingType.CLEAR },
            margins: { top: 120, bottom: 120, left: 200, right: 200 },
            children: [
              new Paragraph({ 
                spacing: { after: 60 },
                children: [new TextRun({ text: title, bold: true, size: 22 })] 
              }),
              new Paragraph({ children: [new TextRun({ text: content, size: 20 })] })
            ]
          })
        ]
      })
    ]
  });
}

const doc = new Document({
  styles: {
    default: { document: { run: { font: "Arial", size: 22 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 36, bold: true, color: brandBlue, font: "Arial" },
        paragraph: { spacing: { before: 400, after: 200 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 28, bold: true, color: brandBlue, font: "Arial" },
        paragraph: { spacing: { before: 300, after: 150 }, outlineLevel: 1 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 24, bold: true, color: "374151", font: "Arial" },
        paragraph: { spacing: { before: 200, after: 100 }, outlineLevel: 2 } },
    ]
  },
  numbering: {
    config: [
      { reference: "bullets",
        levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
    ]
  },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
      }
    },
    children: [
      // Title
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 100 },
        children: [new TextRun({ text: "IMPROVED EMAIL SEQUENCE", bold: true, size: 44, color: brandBlue })]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
        children: [new TextRun({ text: "TeamShotsPro Apollo Outreach", size: 26, color: "6B7280" })]
      }),

      // Overview
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Sequence Overview")] }),
      
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        columnWidths: [3000, 6360],
        rows: [
          new TableRow({ children: [
            new TableCell({ borders: cellBorders, shading: { fill: lightGray, type: ShadingType.CLEAR }, margins: { top: 80, bottom: 80, left: 120, right: 120 }, width: { size: 3000, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun({ text: "Sequence Name", bold: true })] })] }),
            new TableCell({ borders: cellBorders, margins: { top: 80, bottom: 80, left: 120, right: 120 }, width: { size: 6360, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun("TeamShotsPro - General Outreach v2")] })] })
          ]}),
          new TableRow({ children: [
            new TableCell({ borders: cellBorders, shading: { fill: lightGray, type: ShadingType.CLEAR }, margins: { top: 80, bottom: 80, left: 120, right: 120 }, width: { size: 3000, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun({ text: "Steps", bold: true })] })] }),
            new TableCell({ borders: cellBorders, margins: { top: 80, bottom: 80, left: 120, right: 120 }, width: { size: 6360, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun("3 emails")] })] })
          ]}),
          new TableRow({ children: [
            new TableCell({ borders: cellBorders, shading: { fill: lightGray, type: ShadingType.CLEAR }, margins: { top: 80, bottom: 80, left: 120, right: 120 }, width: { size: 3000, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun({ text: "Timing", bold: true })] })] }),
            new TableCell({ borders: cellBorders, margins: { top: 80, bottom: 80, left: 120, right: 120 }, width: { size: 6360, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun("Day 1 → Day 4 → Day 9")] })] })
          ]}),
          new TableRow({ children: [
            new TableCell({ borders: cellBorders, shading: { fill: lightGray, type: ShadingType.CLEAR }, margins: { top: 80, bottom: 80, left: 120, right: 120 }, width: { size: 3000, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun({ text: "Send Time", bold: true })] })] }),
            new TableCell({ borders: cellBorders, margins: { top: 80, bottom: 80, left: 120, right: 120 }, width: { size: 6360, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun("9:00 AM recipient timezone (Tue-Thu preferred)")] })] })
          ]}),
        ]
      }),
      new Paragraph({ spacing: { after: 300 }, children: [] }),

      // Email 1
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Email 1: Opening Touch")] }),
      new Paragraph({ spacing: { after: 50 }, children: [new TextRun({ text: "Send: ", bold: true }), new TextRun("Immediately when added to sequence")] }),
      new Paragraph({ spacing: { after: 50 }, children: [new TextRun({ text: "Type: ", bold: true }), new TextRun("New thread")] }),
      new Paragraph({ spacing: { after: 200 }, children: [] }),

      new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun("Subject Line (A/B Test)")] }),
      infoBox("Version A (Recommended)", "Quick question about {{company}}'s team photos"),
      new Paragraph({ spacing: { after: 100 }, children: [] }),
      infoBox("Version B", "{{company}} + professional headshots?"),
      new Paragraph({ spacing: { after: 200 }, children: [] }),

      new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun("Email Body")] }),
      codeBlock([
        "Hi {{first_name}},",
        "",
        "I was looking at {{company}}'s website and noticed your team is growing.",
        "Quick question: how do you currently handle headshots for new hires?",
        "",
        "Most teams I talk to either:",
        "- Wait months to schedule a photographer",
        "- End up with mismatched photos across LinkedIn, Slack, and the website",
        "- Give up and use whatever selfie people submit",
        "",
        "We built TeamShotsPro to solve this. Your team uploads a selfie,",
        "and we deliver polished, on-brand headshots in under 10 minutes.",
        "No photographer. No scheduling. Consistent style across everyone.",
        "",
        "Worth a quick look?",
        "",
        "Best,",
        "Matthieu",
        "",
        "P.S. Here's a 2-minute demo if you're curious: https://calendly.com/teamshotspro/demo"
      ]),
      new Paragraph({ spacing: { after: 300 }, children: [] }),

      new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun("Why This Works")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun({ text: "Personalization: ", bold: true }), new TextRun("Uses {{company}} in subject AND body")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun({ text: "Research signal: ", bold: true }), new TextRun("\"I was looking at your website\" shows effort")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun({ text: "Problem-focused: ", bold: true }), new TextRun("Lists 3 pain points they likely experience")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun({ text: "Low-pressure CTA: ", bold: true }), new TextRun("\"Worth a quick look?\" is easy to say yes to")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 300 }, children: [new TextRun({ text: "P.S. technique: ", bold: true }), new TextRun("Calendly link in postscript gets noticed")] }),

      new Paragraph({ children: [new PageBreak()] }),

      // Email 2
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Email 2: Value + Social Proof")] }),
      new Paragraph({ spacing: { after: 50 }, children: [new TextRun({ text: "Send: ", bold: true }), new TextRun("3 days after Email 1")] }),
      new Paragraph({ spacing: { after: 50 }, children: [new TextRun({ text: "Type: ", bold: true }), new TextRun("Reply to Email 1 (same thread)")] }),
      new Paragraph({ spacing: { after: 200 }, children: [] }),

      new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun("Subject Line")] }),
      infoBox("Subject", "Re: Quick question about {{company}}'s team photos", lightGray),
      new Paragraph({ spacing: { after: 200 }, children: [] }),

      new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun("Email Body")] }),
      codeBlock([
        "Hi {{first_name}},",
        "",
        "Wanted to share a quick example.",
        "",
        "Last month, a 40-person consulting firm came to us with a familiar problem:",
        "half their team had professional headshots, half had phone selfies,",
        "and their \"About Us\" page looked like a patchwork quilt.",
        "",
        "Within a week, every employee had a polished, consistent headshot.",
        "No photographer visits. No scheduling headaches. Total cost: less than",
        "what they'd pay for 3 traditional headshots.",
        "",
        "If {{company}} ever runs into the same challenge, I'd love to show you",
        "how it works. Here's my calendar:",
        "",
        "https://calendly.com/teamshotspro/demo",
        "",
        "Either way, happy to answer any questions.",
        "",
        "Matthieu"
      ]),
      new Paragraph({ spacing: { after: 300 }, children: [] }),

      new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun("Why This Works")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun({ text: "Social proof: ", bold: true }), new TextRun("Real example with specific details (40-person firm)")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun({ text: "Relatable pain: ", bold: true }), new TextRun("\"Patchwork quilt\" visual resonates")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun({ text: "ROI mention: ", bold: true }), new TextRun("Cost comparison plants the seed")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun({ text: "Clear CTA: ", bold: true }), new TextRun("Calendly link is prominent, not hidden")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 300 }, children: [new TextRun({ text: "No pressure: ", bold: true }), new TextRun("\"Either way\" softens the ask")] }),

      new Paragraph({ children: [new PageBreak()] }),

      // Email 3
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Email 3: Final Touch")] }),
      new Paragraph({ spacing: { after: 50 }, children: [new TextRun({ text: "Send: ", bold: true }), new TextRun("5 days after Email 2")] }),
      new Paragraph({ spacing: { after: 50 }, children: [new TextRun({ text: "Type: ", bold: true }), new TextRun("New thread (breakup style)")] }),
      new Paragraph({ spacing: { after: 200 }, children: [] }),

      new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun("Subject Line (A/B Test)")] }),
      infoBox("Version A (Recommended)", "Closing the loop"),
      new Paragraph({ spacing: { after: 100 }, children: [] }),
      infoBox("Version B", "Not the right time?"),
      new Paragraph({ spacing: { after: 200 }, children: [] }),

      new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun("Email Body")] }),
      codeBlock([
        "Hi {{first_name}},",
        "",
        "I'll keep this short.",
        "",
        "I reached out about helping {{company}} with team headshots.",
        "If it's not a priority right now, no worries at all.",
        "",
        "But if you ever need to:",
        "- Onboard new hires with professional photos on day one",
        "- Update outdated headshots across your team",
        "- Get everyone looking consistent for a rebrand or website refresh",
        "",
        "I'm happy to help. Just reply to this email or grab 10 minutes here:",
        "https://calendly.com/teamshotspro/demo",
        "",
        "All the best,",
        "Matthieu",
        "",
        "P.S. No hard feelings if this isn't for you. I'll stop reaching out",
        "after this one."
      ]),
      new Paragraph({ spacing: { after: 300 }, children: [] }),

      new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun("Why This Works")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun({ text: "Breakup psychology: ", bold: true }), new TextRun("\"I'll stop reaching out\" creates urgency")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun({ text: "Future-pacing: ", bold: true }), new TextRun("Lists scenarios when they WILL need this")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun({ text: "Respectful: ", bold: true }), new TextRun("\"No worries\" acknowledges their time")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun({ text: "Multiple CTAs: ", bold: true }), new TextRun("Reply OR Calendly gives options")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 400 }, children: [new TextRun({ text: "Clean exit: ", bold: true }), new TextRun("P.S. reduces opt-outs by being transparent")] }),

      // Setup Instructions
      new Paragraph({ children: [new PageBreak()] }),
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Apollo Setup Instructions")] }),

      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Step 1: Create the Sequence")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun("Go to Engage → Sequences → Create Sequence")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun("Name it \"TeamShotsPro - General Outreach v2\"")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 200 }, children: [new TextRun("Set sequence type to \"Email only\"")] }),

      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Step 2: Configure Email 1")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun("Add Step → Automatic Email")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun("Set to send immediately")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun("Enable A/B testing, add both subject variants")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 200 }, children: [new TextRun("Copy the email body exactly as shown above")] }),

      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Step 3: Configure Email 2")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun("Add Step → Automatic Email")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun("Set delay: 3 business days")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun("Set type: Reply to previous email")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 200 }, children: [new TextRun("Copy the email body exactly as shown above")] }),

      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Step 4: Configure Email 3")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun("Add Step → Automatic Email")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun("Set delay: 5 business days")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun("Set type: New thread")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun("Enable A/B testing for subject lines")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 200 }, children: [new TextRun("Copy the email body exactly as shown above")] }),

      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Step 5: Sequence Settings")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun("Sending window: 9 AM - 11 AM recipient timezone")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun("Sending days: Tuesday, Wednesday, Thursday")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun("Stop on reply: Enabled")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun("Stop on meeting booked: Enabled")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 400 }, children: [new TextRun("Daily sending limit: Start with 30-50 per day")] }),

      // Variables Reference
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Apollo Variables Reference")] }),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        columnWidths: [3500, 5860],
        rows: [
          new TableRow({ children: [
            new TableCell({ borders: cellBorders, shading: { fill: brandBlue, type: ShadingType.CLEAR }, margins: { top: 80, bottom: 80, left: 120, right: 120 }, width: { size: 3500, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun({ text: "Variable", bold: true, color: "FFFFFF" })] })] }),
            new TableCell({ borders: cellBorders, shading: { fill: brandBlue, type: ShadingType.CLEAR }, margins: { top: 80, bottom: 80, left: 120, right: 120 }, width: { size: 5860, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun({ text: "What It Inserts", bold: true, color: "FFFFFF" })] })] })
          ]}),
          new TableRow({ children: [
            new TableCell({ borders: cellBorders, margins: { top: 80, bottom: 80, left: 120, right: 120 }, width: { size: 3500, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun({ text: "{{first_name}}", font: "Courier New" })] })] }),
            new TableCell({ borders: cellBorders, margins: { top: 80, bottom: 80, left: 120, right: 120 }, width: { size: 5860, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun("Contact's first name")] })] })
          ]}),
          new TableRow({ children: [
            new TableCell({ borders: cellBorders, margins: { top: 80, bottom: 80, left: 120, right: 120 }, width: { size: 3500, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun({ text: "{{company}}", font: "Courier New" })] })] }),
            new TableCell({ borders: cellBorders, margins: { top: 80, bottom: 80, left: 120, right: 120 }, width: { size: 5860, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun("Contact's company name")] })] })
          ]}),
          new TableRow({ children: [
            new TableCell({ borders: cellBorders, margins: { top: 80, bottom: 80, left: 120, right: 120 }, width: { size: 3500, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun({ text: "{{title}}", font: "Courier New" })] })] }),
            new TableCell({ borders: cellBorders, margins: { top: 80, bottom: 80, left: 120, right: 120 }, width: { size: 5860, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun("Contact's job title")] })] })
          ]}),
        ]
      }),
      new Paragraph({ spacing: { after: 400 }, children: [] }),

      // Footer
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 400 },
        children: [new TextRun({ text: "Ready to launch! Good luck with your outreach.", size: 22, color: "6B7280" })]
      }),
    ]
  }]
});

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync('/sessions/laughing-sleepy-faraday/mnt/teamshots/TeamShotsPro_Email_Sequence_v2.docx', buffer);
  console.log('Sequence document created!');
});
