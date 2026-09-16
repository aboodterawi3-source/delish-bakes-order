import { useId, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Send } from "lucide-react";
import { submitCustomerMessage } from "@/lib/customer-messages.functions";
import { useLang } from "@/lib/i18n";

/**
 * Public comments / issues form. Messages land in the staff portal where sales,
 * social and admin can follow up.
 */
export function ContactSection() {
  const { lang } = useLang();
  const ar = lang === "ar";
  const send = useServerFn(submitCustomerMessage);
  const nameId = useId();
  const phoneId = useId();
  const messageId = useId();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");

  const mutation = useMutation({
    mutationFn: () => send({ data: { name: name.trim(), phone: phone.trim(), message: message.trim() } }),
    onSuccess: () => {
      setName("");
      setPhone("");
      setMessage("");
    },
  });

  const field =
    "w-full min-h-12 rounded-2xl border border-input bg-background px-4 py-3 text-sm outline-none focus:border-gold";
  const label = "mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted-foreground";

  return (
    <section aria-labelledby="contact-heading" className="space-y-3 rounded-3xl border border-border bg-card/80 p-5 shadow-sm">
      <div>
        <h3 id="contact-heading" className="text-sm font-bold text-foreground sm:text-base">
          {ar ? "ملاحظات أو مشكلة؟ راسلنا" : "Comments or an issue? Message us"}
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          {ar
            ? "اكتب لنا ملاحظتك وسيتواصل معك فريقنا في أقرب وقت."
            : "Send us your note and our team will get back to you shortly."}
        </p>
      </div>

      {mutation.isSuccess ? (
        <p className="flex items-center gap-2 rounded-2xl bg-secondary/40 p-3 text-xs font-bold text-foreground">
          <CheckCircle2 className="h-4 w-4 text-whatsapp" aria-hidden />
          {ar ? "تم استلام رسالتك، شكراً لك!" : "We received your message, thank you!"}
        </p>
      ) : (
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            mutation.mutate();
          }}
        >
          <div className="grid gap-3 min-[360px]:grid-cols-2">
            <div>
              <label htmlFor={nameId} className={label}>
                {ar ? "الاسم" : "Name"}
              </label>
              <input id={nameId} value={name} onChange={(e) => setName(e.target.value)} className={field} required maxLength={80} />
            </div>
            <div>
              <label htmlFor={phoneId} className={label}>
                {ar ? "رقم الهاتف" : "Phone"}
              </label>
              <input
                id={phoneId}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={field}
                dir="ltr"
                inputMode="tel"
                placeholder="07 9999 9999"
                required
                maxLength={25}
              />
            </div>
          </div>
          <div>
            <label htmlFor={messageId} className={label}>
              {ar ? "ملاحظتك أو مشكلتك" : "Your comment or issue"}
            </label>
            <textarea
              id={messageId}
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full rounded-2xl border border-input bg-background p-3 text-sm outline-none focus:border-gold"
              required
              maxLength={1500}
            />
          </div>
          {mutation.isError && (
            <p className="text-xs font-bold text-destructive">
              {ar ? "تعذّر إرسال الرسالة، حاول مرة أخرى." : "Could not send your message, please try again."}
            </p>
          )}
          <button
            type="submit"
            disabled={mutation.isPending}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-primary text-sm font-bold text-primary-foreground disabled:opacity-70"
          >
            <Send className="h-4 w-4" aria-hidden />
            {mutation.isPending ? (ar ? "جارٍ الإرسال…" : "Sending…") : ar ? "إرسال" : "Send"}
          </button>
        </form>
      )}
    </section>
  );
}
