import { Link } from "wouter";
import { ArrowLeft, Shield, BookOpen, AlertTriangle, Eye, MessageSquare, HelpCircle } from "lucide-react";
import { WILDO_LOGO } from "@/lib/branding";

export default function Terms() {
  return (
    <div className="max-w-2xl mx-auto py-8 px-4 animate-in fade-in duration-300">
      {/* Back */}
      <Link href="/">
        <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to app
        </button>
      </Link>

      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <img
          src={WILDO_LOGO}
          alt="Wildo"
          className="w-12 h-12 rounded-full object-contain bg-white ring-2 ring-primary/30"
        />
        <div>
          <h1 className="text-2xl font-bold font-serif">Terms &amp; Conditions</h1>
          <p className="text-sm text-muted-foreground">Wildo · Cambridge AI Tutor · Last updated July 2026</p>
        </div>
      </div>

      <div className="space-y-8 text-sm leading-relaxed text-foreground/90">

        <section className="p-5 rounded-2xl border bg-primary/5">
          <p className="text-base font-semibold font-serif mb-1">Welcome to Wildo</p>
          <p className="text-muted-foreground">
            Wildo is a Cambridge O/A Level AI study assistant created by <strong>I.Nairoo</strong>. 
            By using Wildo, you agree to these terms. Please read them carefully.
          </p>
        </section>

        <section>
          <div className="flex items-center gap-2 mb-3">
            <BookOpen className="w-4 h-4 text-primary" />
            <h2 className="font-semibold text-base">1. Educational Purpose</h2>
          </div>
          <p className="text-muted-foreground">
            Wildo is designed solely as a revision and study aid for Cambridge International O Level and A Level students. 
            All AI-generated content — including questions, answers, flashcards, and revision notes — is intended to supplement 
            your studies, not replace your teacher, school, or official Cambridge resources.
          </p>
        </section>

        <section>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <h2 className="font-semibold text-base">2. AI Limitations &amp; Accuracy</h2>
          </div>
          <ul className="text-muted-foreground space-y-2 list-none">
            <li className="flex gap-2"><span className="text-primary mt-0.5">•</span>Wildo uses AI (GPT-4o) to generate content. While we verify responses against Cambridge syllabuses, <strong>AI can make mistakes</strong>. Always cross-check important answers with your teacher or official Cambridge mark schemes.</li>
            <li className="flex gap-2"><span className="text-primary mt-0.5">•</span>A <strong>verification badge</strong> is shown for each AI response — green means high confidence, amber means uncertain. Treat amber responses with extra caution.</li>
            <li className="flex gap-2"><span className="text-primary mt-0.5">•</span>Wildo does not guarantee any particular exam results. Study outcomes depend on your own effort and many other factors.</li>
          </ul>
        </section>

        <section>
          <div className="flex items-center gap-2 mb-3">
            <Eye className="w-4 h-4 text-primary" />
            <h2 className="font-semibold text-base">3. Privacy &amp; Your Data</h2>
          </div>
          <ul className="text-muted-foreground space-y-2 list-none">
            <li className="flex gap-2"><span className="text-primary mt-0.5">•</span>Your account is created via <strong>Replit Auth</strong>. We store only what is necessary: your user ID, name, and the study data you create (notes, flashcards, conversations).</li>
            <li className="flex gap-2"><span className="text-primary mt-0.5">•</span>Your data is <strong>private to your account</strong>. No other student can see your notes, flashcards, or conversations.</li>
            <li className="flex gap-2"><span className="text-primary mt-0.5">•</span>We do not sell your data to third parties.</li>
            <li className="flex gap-2"><span className="text-primary mt-0.5">•</span>Conversations are sent to OpenAI to generate responses. OpenAI's own privacy policy applies to that processing.</li>
          </ul>
        </section>

        <section>
          <div className="flex items-center gap-2 mb-3">
            <MessageSquare className="w-4 h-4 text-primary" />
            <h2 className="font-semibold text-base">4. Acceptable Use</h2>
          </div>
          <ul className="text-muted-foreground space-y-2 list-none">
            <li className="flex gap-2"><span className="text-primary mt-0.5">•</span>Wildo is for <strong>personal, non-commercial study use only</strong>.</li>
            <li className="flex gap-2"><span className="text-primary mt-0.5">•</span>Do not attempt to misuse the AI to generate harmful, offensive, or misleading content.</li>
            <li className="flex gap-2"><span className="text-primary mt-0.5">•</span>Do not share your login credentials with others.</li>
            <li className="flex gap-2"><span className="text-primary mt-0.5">•</span>Academic integrity is your responsibility — using AI-generated answers and presenting them as your own work in graded assessments may violate your school's academic integrity policy.</li>
          </ul>
        </section>

        <section>
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-4 h-4 text-primary" />
            <h2 className="font-semibold text-base">5. Intellectual Property</h2>
          </div>
          <p className="text-muted-foreground">
            Wildo and its branding (including the "WA" logo) are created by <strong>I.Nairoo</strong>. 
            Cambridge International Examinations and all associated syllabuses are the intellectual property of 
            Cambridge Assessment International Education. Wildo is an independent tool and is not affiliated with, 
            endorsed by, or officially connected to Cambridge Assessment International Education.
          </p>
        </section>

        <section>
          <div className="flex items-center gap-2 mb-3">
            <HelpCircle className="w-4 h-4 text-primary" />
            <h2 className="font-semibold text-base">6. Changes &amp; Availability</h2>
          </div>
          <p className="text-muted-foreground">
            Wildo is provided as-is. We may update features, correct errors, or take the service offline at any time 
            without prior notice. These terms may be updated — the date at the top of this page will reflect the most 
            recent version.
          </p>
        </section>

        {/* Footer signature */}
        <div className="pt-6 border-t flex items-center gap-3 text-muted-foreground">
          <img
            src={WILDO_LOGO}
            alt="Wildo"
            className="w-8 h-8 rounded-full object-contain bg-white opacity-60"
          />
          <div>
            <p className="text-xs font-semibold text-foreground">Wildo — Cambridge AI Tutor</p>
            <p className="text-xs">Created &amp; owned by <strong>I.Nairoo</strong> · © {new Date().getFullYear()}</p>
          </div>
        </div>

      </div>
    </div>
  );
}
