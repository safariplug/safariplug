import { sealHotelbedsActivitySelectionToken } from "./activity-selection-token";

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function numberValue(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function array(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function activityRoot(payload: unknown) {
  const root = record(payload);
  if (!root) return null;
  return record(root.activity) || record(array(root.activities)[0]) || null;
}

function imageUrl(activity: Record<string, unknown>) {
  const content = record(activity.content);
  const media = record(content?.media);
  const images = array(media?.images);
  for (const imageValue of images) {
    const image = record(imageValue);
    if (!image) continue;
    for (const urlValue of array(image.urls)) {
      const url = record(urlValue);
      const resource = text(url?.resource);
      if (resource) return resource;
    }
  }
  return null;
}

export function sanitizeHotelbedsActivitySearch(payload: unknown) {
  const root = record(payload);
  const rows = array(root?.activities);
  return rows.flatMap((row) => {
    const activity = record(row);
    if (!activity) return [];
    const code = text(activity.code);
    const name = text(activity.name);
    if (!code || !name) return [];
    const content = record(activity.content);
    const description = text(content?.description) || text(content?.summary) || null;
    const amounts = array(activity.amountsFrom)
      .map(record)
      .filter((value): value is Record<string, unknown> => Boolean(value))
      .map((amount) => ({
        paxType: text(amount.paxType) || null,
        ageFrom: numberValue(amount.ageFrom) ?? null,
        ageTo: numberValue(amount.ageTo) ?? null,
        amount: numberValue(amount.amount) ?? null,
      }))
      .filter((amount) => amount.amount !== null);
    return [{
      code,
      name,
      description,
      currency: text(activity.currency) || text(activity.currencyName) || null,
      imageUrl: imageUrl(activity),
      amountsFrom: amounts,
    }];
  });
}

export function extractHotelbedsActivitySelections(
  payload: unknown,
  paxes: Array<{ age: number }>
) {
  const activity = activityRoot(payload);
  if (!activity) return [];

  const activityCode = text(activity.code);
  const activityName = text(activity.name) || "Hotelbeds activity";
  const supplierCurrency = (text(activity.currency) || text(activity.currencyName) || "").toUpperCase();
  if (!activityCode || !supplierCurrency) return [];

  const selections: Array<{
    selectionToken: string;
    supplierAmount: number;
    supplierCurrency: string;
    activityCode: string;
    activityName: string;
    modalityCode: string;
    modalityName: string;
    from: string;
    to: string;
    rateClass: string | null;
    freeCancellation: boolean | null;
    cancellationPolicies: Array<Record<string, unknown>>;
    session: Record<string, unknown> | null;
    language: Record<string, unknown> | null;
    questions: Array<Record<string, unknown>>;
    comments: string[];
  }> = [];

  for (const modalityValue of array(activity.modalities)) {
    const modality = record(modalityValue);
    if (!modality) continue;
    const modalityCode = text(modality.code);
    const modalityName = text(modality.name) || modalityCode || "Activity option";
    if (!modalityCode) continue;

    const questions = array(modality.questions)
      .map(record)
      .filter((value): value is Record<string, unknown> => Boolean(value))
      .flatMap((question) => {
        const code = text(question.code);
        const qtext = text(question.text);
        if (!code || !qtext) return [];
        return [{ code, text: qtext, required: question.required !== false }];
      });

    const comments = array(modality.comments)
      .map(record)
      .filter((value): value is Record<string, unknown> => Boolean(value))
      .map((comment) => text(comment.text))
      .filter((value): value is string => Boolean(value));

    for (const rateValue of array(modality.rates)) {
      const rate = record(rateValue);
      if (!rate) continue;
      const rateClass = text(rate.rateClass) || null;
      const freeCancellation =
        typeof rate.freeCancellation === "boolean" ? rate.freeCancellation : null;

      for (const detailValue of array(rate.rateDetails)) {
        const detail = record(detailValue);
        if (!detail) continue;
        const rateKey = text(detail.rateKey);
        const totalAmount = record(detail.totalAmount);
        const supplierAmount = numberValue(totalAmount?.amount);
        if (!rateKey || supplierAmount === undefined) continue;

        const operationDates = array(detail.operationDates)
          .map(record)
          .filter((value): value is Record<string, unknown> => Boolean(value));
        const sessions = array(detail.sessions)
          .map(record)
          .filter((value): value is Record<string, unknown> => Boolean(value));
        const languages = array(detail.languages)
          .map(record)
          .filter((value): value is Record<string, unknown> => Boolean(value));

        const sessionOptions = sessions.length ? sessions : [null];
        const languageOptions = languages.length ? languages : [null];

        for (const operationDate of operationDates.length ? operationDates : [null]) {
          const from = text(operationDate?.from);
          const to = text(operationDate?.to);
          if (!from || !to) continue;

          const cancellationPolicies = array(operationDate?.cancellationPolicies)
            .map(record)
            .filter((value): value is Record<string, unknown> => Boolean(value))
            .map((policy) => ({
              amount: numberValue(policy.amount) ?? null,
              dateFrom: text(policy.dateFrom) || text(policy.from) || null,
              dateTo: text(policy.dateTo) || text(policy.to) || null,
            }));

          for (const session of sessionOptions) {
            for (const language of languageOptions) {
              const sessionCode = session ? text(session.code) || null : null;
              const sessionName = session ? text(session.name) || null : null;
              const languageCode = language ? text(language.code) || null : null;
              const languageName = language ? text(language.name) || text(language.description) || null : null;

              const selectionToken = sealHotelbedsActivitySelectionToken({
                activityCode,
                activityName,
                modalityCode,
                modalityName,
                rateKey,
                from,
                to,
                paxes,
                supplierAmount,
                supplierCurrency,
                rateClass,
                freeCancellation,
                cancellationPolicies,
                sessionCode,
                sessionName,
                languageCode,
                languageName,
                questions,
                comments,
              });

              selections.push({
                selectionToken,
                supplierAmount,
                supplierCurrency,
                activityCode,
                activityName,
                modalityCode,
                modalityName,
                from,
                to,
                rateClass,
                freeCancellation,
                cancellationPolicies,
                session: sessionCode ? { code: sessionCode, name: sessionName } : null,
                language: languageCode ? { code: languageCode, name: languageName } : null,
                questions,
                comments,
              });
            }
          }
        }
      }
    }
  }

  return selections;
}

export function normalizeActivityHolder(value: unknown) {
  const holder = record(value) || {};
  const name = text(holder.name);
  const surname = text(holder.surname);
  const email = text(holder.email);
  const phone = text(holder.phone);
  if (!name || !surname || !email || !phone) {
    throw new Error("Holder name, surname, email and phone are required.");
  }
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
    throw new Error("Holder phone must use international E.164 format.");
  }
  return { name, surname, email, telephones: [phone], mailing: false };
}

export function normalizeActivityPaxes(
  ages: Array<{ age: number }>,
  value: unknown
) {
  if (!Array.isArray(value) || value.length !== ages.length) {
    throw new Error("Passenger details must match the passenger ages used for availability.");
  }
  const paxes = value.map((row, index) => {
    const pax = record(row) || {};
    const name = text(pax.name);
    const surname = text(pax.surname);
    if (!name || !surname) throw new Error(`Passenger ${index + 1} requires first and last name.`);
    const age = ages[index]?.age;
    return {
      age,
      name,
      surname,
      type: age >= 18 ? "ADULT" : "CHILD",
    };
  });
  return [...paxes.filter((p) => p.type === "ADULT"), ...paxes.filter((p) => p.type === "CHILD")];
}

export function normalizeActivityAnswers(
  questions: Array<{ code: string; text: string; required: boolean }> | undefined,
  value: unknown
) {
  const supplied = Array.isArray(value) ? value : [];
  const answerMap = new Map<string, string>();
  for (const row of supplied) {
    const answer = record(row);
    const code = text(answer?.code);
    const response = text(answer?.answer);
    if (code && response) answerMap.set(code, response);
  }
  const required = questions || [];
  for (const question of required) {
    if (question.required && !answerMap.get(question.code)) {
      throw new Error(`Answer required: ${question.text}`);
    }
  }
  return required
    .filter((question) => answerMap.has(question.code))
    .map((question) => ({
      question: { code: question.code, text: question.text, required: question.required },
      answer: answerMap.get(question.code),
    }));
}

export function activityBookingReference(payload: unknown) {
  return text(record(record(payload)?.booking)?.reference);
}
