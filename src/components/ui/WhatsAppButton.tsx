'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';

export function WhatsAppButton({
  phoneNumber = '6594519986', // +65 94519986 (no + or spaces)
  message = 'Hi Carrom Balu! I would like to know more about CBOT (Carrom Balu Online Tournament).',
  contactName = 'Carrom Balu',
}: {
  phoneNumber?: string;
  message?: string;
  contactName?: string;
}) {
  const pathname = usePathname();
  if (pathname?.includes('/live')) {
    return null;
  }
  const href = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Chat with ${contactName} on WhatsApp`}
      className="whatsapp-float-btn group"
      title={`Message ${contactName} on WhatsApp`}
    >
      {/* WhatsApp SVG Icon */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 32 32"
        fill="white"
        className="h-7 w-7 flex-shrink-0"
      >
        <path d="M16.003 2C8.276 2 2 8.268 2 15.987c0 2.458.649 4.861 1.882 6.977L2 30l7.244-1.857A14.027 14.027 0 0 0 16.003 30C23.729 30 30 23.731 30 16.011 30 8.27 23.729 2 16.003 2zm7.438 20.068c-.318.889-1.567 1.629-2.575 1.843-.685.145-1.582.26-4.593-1.008-3.865-1.596-6.352-5.519-6.544-5.777-.186-.258-1.573-2.093-1.573-3.993 0-1.9.991-2.83 1.342-3.222.352-.391.769-.488.967-.488l.695.013c.222.009.521-.084.816.624.305.731 1.039 2.53 1.131 2.715.091.184.152.4.03.644-.12.243-.18.393-.356.605-.178.21-.376.47-.537.631-.178.178-.365.37-.157.725.208.354.924 1.522 1.984 2.468 1.363 1.218 2.513 1.594 2.866 1.773.354.178.56.148.767-.09.208-.237.893-.969 1.13-1.302.237-.332.474-.278.797-.167.322.112 2.047.965 2.4 1.143.353.178.587.267.674.415.087.149.087.863-.231 1.753z" />
      </svg>

      {/* Tooltip / Label */}
      <span className="whatsapp-float-label">
        Message {contactName}
      </span>
    </a>
  );
}
