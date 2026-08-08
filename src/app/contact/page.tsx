'use client';

import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Mail, Phone, MapPin, Send, HelpCircle, ShieldCheck, CheckCircle2 } from 'lucide-react';

export default function ContactPage() {
  const [submitted, setSubmitted] = React.useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 4000);
  };

  const faqs = [
    {
      q: 'How do I register a new team for upcoming CBOT editions?',
      a: 'Navigate to the Register page or Captain Dashboard to create a team account and register your starting roster.',
    },
    {
      q: 'What is the required video proof standard for score verification?',
      a: 'Captains must provide raw 60fps video clips or live stream links showing board coins placement and mandatory queen cover strikes.',
    },
    {
      q: 'How are ELO ratings updated after matches?',
      a: 'ELO points are automatically calculated based on opponent rating differentials, total boards won, and queen cover bonuses upon organizer score approval.',
    },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 space-y-12">
      
      {/* Header */}
      <div className="text-center space-y-3 max-w-2xl mx-auto">
        <Badge variant="carrom" className="px-4 py-1 font-bold">Contact & Support</Badge>
        <h1 className="text-4xl font-black tracking-tight">Get in Touch with CBOT Officials</h1>
        <p className="text-muted-foreground text-sm">
          Have questions regarding team entries, referee score disputes, sponsorship, or tournament rules? Send us a message below.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Contact Form */}
        <Card className="lg:col-span-7 p-6 border-border space-y-4">
          <CardHeader className="p-0 mb-4">
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <Mail className="h-5 w-5 text-amber-500" /> Send Support Request
            </CardTitle>
          </CardHeader>

          {submitted ? (
            <div className="p-6 text-center space-y-3 bg-emerald-500/10 rounded-2xl border border-emerald-500/30">
              <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto" />
              <h3 className="text-lg font-bold text-emerald-500">Message Received!</h3>
              <p className="text-xs text-muted-foreground">The CBOT referee committee will respond within 24 hours.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold block mb-1">Your Name</label>
                  <Input required placeholder="Balu Master" />
                </div>
                <div>
                  <label className="text-xs font-bold block mb-1">Email Address</label>
                  <Input type="email" required placeholder="name@cbot.gg" />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold block mb-1">Inquiry Category</label>
                <Select defaultValue="DISPUTE">
                  <option value="DISPUTE">Score Report / Referee Dispute Assistance</option>
                  <option value="REGISTRATION">Team Registration Inquiry</option>
                  <option value="SPONSORSHIP">Tournament Sponsorship & Media</option>
                  <option value="GENERAL">General Question</option>
                </Select>
              </div>

              <div>
                <label className="text-xs font-bold block mb-1">Message Details</label>
                <textarea
                  rows={4}
                  required
                  className="w-full rounded-lg border border-input bg-background p-2.5 text-xs focus:ring-2 focus:ring-ring outline-none"
                  placeholder="Describe your inquiry or match reference ID..."
                />
              </div>

              <Button type="submit" variant="carrom" className="w-full font-bold justify-center">
                Send Message <Send className="h-4 w-4 ml-1.5" />
              </Button>
            </form>
          )}
        </Card>

        {/* Contact Info & FAQ Accordion */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="p-6 border-amber-500/30 bg-amber-500/5 space-y-4">
            <h3 className="font-bold text-base flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-amber-500" /> Direct Organizer Desk
            </h3>
            <div className="space-y-2 text-xs text-muted-foreground">
              <p><strong className="text-foreground">Chief Director:</strong> Balu Master (Carrom Balu)</p>
              <p><strong className="text-foreground">Official Email:</strong> support@cbot.gg</p>
              <p><strong className="text-foreground">Broadcast Hub:</strong> Chennai, Tamil Nadu, India</p>
            </div>
          </Card>

          <Card className="p-6 border-border space-y-4">
            <h3 className="font-bold text-base flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-amber-500" /> Frequently Asked Questions
            </h3>
            <div className="space-y-3">
              {faqs.map((faq, idx) => (
                <div key={idx} className="p-3 rounded-xl bg-muted/50 border border-border/50 text-xs space-y-1">
                  <div className="font-bold text-foreground">{faq.q}</div>
                  <div className="text-muted-foreground leading-relaxed">{faq.a}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>

      </div>
    </div>
  );
}
