import EnrollmentFloatingBar from '@/components/home/EnrollmentFloatingBar';
import { resolveRegistrationEdition } from '@/lib/current-edition';

export async function EnrollmentBarWithRegistration() {
  try {
    const edition = await resolveRegistrationEdition();
    if (!edition) return null;

    const organizerName =
      edition.organizer?.name?.trim() ||
      edition.organizer?.username?.trim() ||
      'Organizer';

    return (
      <EnrollmentFloatingBar
        edition={{
          id: edition.id,
          title: edition.title,
          number: edition.number,
          theme: edition.theme ?? null,
          enrollmentFee: edition.enrollmentFee ?? 0,
          registrationEndDate: edition.registrationEndDate
            ? edition.registrationEndDate.toISOString()
            : null,
          paymentQrUrl: edition.paymentQrUrl ?? null,
          paymentUpiLink: edition.paymentUpiLink ?? null,
          intlPaymentQrUrl: edition.intlPaymentQrUrl ?? null,
          intlPaymentUpiLink: edition.intlPaymentUpiLink ?? null,
          organizerName,
        }}
      />
    );
  } catch (error) {
    console.error('[EnrollmentBarWithRegistration]', error);
    return null;
  }
}
