import { ActionIcon, Box, Button, Card, Checkbox, CopyButton, Group, Select, Stack, Text, Textarea, TextInput, Title, Tooltip } from "@mantine/core";
import { type CSSProperties, type ReactNode, useState } from "react";
import { QrCode, qrModules } from "../../common/qr";
import { useInitialHashState, useRegisterShareState } from "../../common/share-state";
import { UtilityTitle } from "../../common/utility-title";
import { IconCheck, IconCopy, IconDownload } from "../../icons";
import { download, qrPng, qrSvg } from "./image";
import { addressProblem, linkProblem, type MailFields, numberProblem } from "./links";
import { CORRECTION_OPTIONS, type Kind, KIND_OPTIONS, KINDS, pickCorrection, pickKind, pickText, writePayload } from "./payload";
import type { VCardFields } from "./vcard";
import { keyProblem, pickSecurity, SECURITY_OPTIONS, ssidProblem, type WifiFields } from "./wifi";

export default function QrCodeGenerator() {
  const initialState = useInitialHashState<{
    kind?: string;
    correction?: string;
    text?: string;
    url?: string;
    ssid?: string;
    security?: string;
    password?: string;
    hidden?: boolean;
    first?: string;
    last?: string;
    org?: string;
    job?: string;
    phone?: string;
    email?: string;
    website?: string;
    address?: string;
    note?: string;
    subject?: string;
    body?: string;
    message?: string;
  }>();

  const [kind, setKind] = useState(pickKind(initialState?.kind));
  const [correction, setCorrection] = useState(pickCorrection(initialState?.correction));
  const [text, setText] = useState(pickText(initialState?.text));
  const [url, setUrl] = useState(pickText(initialState?.url));
  const [wifi, setWifi] = useState<WifiFields>(() => ({
    ssid: pickText(initialState?.ssid),
    password: pickText(initialState?.password),
    security: pickSecurity(initialState?.security),
    hidden: initialState?.hidden === true,
  }));
  const [card, setCard] = useState<VCardFields>(() => ({
    first: pickText(initialState?.first),
    last: pickText(initialState?.last),
    org: pickText(initialState?.org),
    job: pickText(initialState?.job),
    phone: pickText(initialState?.phone),
    email: pickText(initialState?.email),
    website: pickText(initialState?.website),
    address: pickText(initialState?.address),
    note: pickText(initialState?.note),
  }));
  const [mail, setMail] = useState<MailFields>(() => ({
    address: pickText(initialState?.email),
    subject: pickText(initialState?.subject),
    body: pickText(initialState?.body),
  }));
  const [number, setNumber] = useState(pickText(initialState?.phone));
  const [message, setMessage] = useState(pickText(initialState?.message));

  const dialling = kind === "phone" || kind === "sms";

  const forKind = (want: Kind, value: string) => kind === want && value ? value : undefined;

  useRegisterShareState(() => ({
    kind,
    correction,
    text: forKind("text", text),
    url: forKind("url", url),
    ssid: forKind("wifi", wifi.ssid),
    security: kind === "wifi" ? wifi.security : undefined,
    password: kind === "wifi" && wifi.security !== "nopass" ? wifi.password || undefined : undefined,
    hidden: kind === "wifi" && wifi.hidden ? true : undefined,
    first: forKind("vcard", card.first),
    last: forKind("vcard", card.last),
    org: forKind("vcard", card.org),
    job: forKind("vcard", card.job),
    website: forKind("vcard", card.website),
    address: forKind("vcard", card.address),
    note: forKind("vcard", card.note),
    subject: forKind("email", mail.subject),
    body: forKind("email", mail.body),
    message: forKind("sms", message),
    email: forKind("vcard", card.email) ?? forKind("email", mail.address),
    phone: forKind("vcard", card.phone) ?? (dialling ? number || undefined : undefined),
  }));

  const urlError = kind === "url" ? linkProblem(url) : null;
  const ssidError = kind === "wifi" ? ssidProblem(wifi.ssid) : null;
  const keyError = kind === "wifi" ? keyProblem(wifi.password, wifi.security) : null;
  const cardPhoneError = kind === "vcard" ? numberProblem(card.phone) : null;
  const cardEmailError = kind === "vcard" ? addressProblem(card.email) : null;
  const cardSiteError = kind === "vcard" ? linkProblem(card.website) : null;
  const mailError = kind === "email" ? addressProblem(mail.address) : null;
  const numberError = dialling ? numberProblem(number) : null;
  const blocked = Boolean(
    urlError || ssidError || keyError || cardPhoneError || cardEmailError || cardSiteError || mailError || numberError,
  );

  const fields = { text, url, wifi, vcard: card, mail, phone: number, sms: { number, message } };
  const payload = blocked ? "" : writePayload(kind, fields);
  const modules = payload === "" ? null : qrModules(payload, correction);
  const fitsLower = payload !== "" && modules === null && correction !== "L" && qrModules(payload, "L") !== null;

  const editWifi = (patch: Partial<WifiFields>) => setWifi({ ...wifi, ...patch });
  const editCard = (patch: Partial<VCardFields>) => setCard({ ...card, ...patch });
  const editMail = (patch: Partial<MailFields>) => setMail({ ...mail, ...patch });

  const saveSvg = () => {
    if (modules) download("qr-code.svg", new Blob([qrSvg(modules)], { type: "image/svg+xml" }));
  };

  const savePng = async () => {
    if (!modules) return;
    const blob = await qrPng(modules);
    if (blob) download("qr-code.png", blob);
  };

  return (
    <Stack gap="md">
      <UtilityTitle directory="qr-code">Generate QR Code</UtilityTitle>

      <Card withBorder shadow="sm" radius="md">
        <Stack>
          <Row>
            <Select
              label="Content type"
              data={KIND_OPTIONS}
              value={kind}
              onChange={(value) => setKind(pickKind(value))}
              allowDeselect={false}
            />
            <Select
              label="Error correction"
              description="How much of the code a reader can lose"
              data={CORRECTION_OPTIONS}
              value={correction}
              onChange={(value) => setCorrection(pickCorrection(value))}
              allowDeselect={false}
            />
          </Row>

          {kind === "text" && (
            <Textarea
              label="Text"
              placeholder="Anything at all"
              value={text}
              onChange={(event) => setText(event.currentTarget.value)}
              autosize
              minRows={3}
              maxRows={10}
            />
          )}

          {kind === "url" && (
            <Row error={urlError}>
              <TextInput
                label="Web address"
                description="https:// is added when there is no scheme"
                placeholder="example.com/page"
                value={url}
                onChange={(event) => setUrl(event.currentTarget.value)}
                error={urlError}
                classNames={ERROR_CLASSES}
                spellCheck={false}
                autoCapitalize="off"
              />
            </Row>
          )}

          {kind === "wifi" && (
            <>
              <Row error={ssidError}>
                <TextInput
                  label="Network name"
                  placeholder="The SSID as the router broadcasts it"
                  value={wifi.ssid}
                  onChange={(event) => editWifi({ ssid: event.currentTarget.value })}
                  error={ssidError}
                  classNames={ERROR_CLASSES}
                  spellCheck={false}
                  autoCapitalize="off"
                />
                <Select
                  label="Security"
                  data={SECURITY_OPTIONS}
                  value={wifi.security}
                  onChange={(value) => editWifi({ security: pickSecurity(value) })}
                  allowDeselect={false}
                />
              </Row>

              {wifi.security !== "nopass" && (
                <Row error={keyError}>
                  <TextInput
                    label="Password"
                    description="Shown rather than masked, this being a key somebody is handing out"
                    value={wifi.password}
                    onChange={(event) => editWifi({ password: event.currentTarget.value })}
                    error={keyError}
                    classNames={ERROR_CLASSES}
                    spellCheck={false}
                    autoCapitalize="off"
                  />
                </Row>
              )}

              <Checkbox
                label="Hidden network"
                checked={wifi.hidden}
                onChange={(event) => editWifi({ hidden: event.currentTarget.checked })}
              />
            </>
          )}

          {kind === "vcard" && (
            <>
              <Row>
                <TextInput
                  label="First name"
                  value={card.first}
                  onChange={(event) => editCard({ first: event.currentTarget.value })}
                />
                <TextInput
                  label="Last name"
                  value={card.last}
                  onChange={(event) => editCard({ last: event.currentTarget.value })}
                />
              </Row>
              <Row>
                <TextInput
                  label="Organisation"
                  value={card.org}
                  onChange={(event) => editCard({ org: event.currentTarget.value })}
                />
                <TextInput
                  label="Job title"
                  value={card.job}
                  onChange={(event) => editCard({ job: event.currentTarget.value })}
                />
              </Row>
              <Row error={cardPhoneError || cardEmailError}>
                <TextInput
                  label="Phone"
                  value={card.phone}
                  onChange={(event) => editCard({ phone: event.currentTarget.value })}
                  error={cardPhoneError}
                  classNames={ERROR_CLASSES}
                />
                <TextInput
                  label="Email"
                  value={card.email}
                  onChange={(event) => editCard({ email: event.currentTarget.value })}
                  error={cardEmailError}
                  classNames={ERROR_CLASSES}
                  spellCheck={false}
                  autoCapitalize="off"
                />
              </Row>
              <Row error={cardSiteError}>
                <TextInput
                  label="Website"
                  value={card.website}
                  onChange={(event) => editCard({ website: event.currentTarget.value })}
                  error={cardSiteError}
                  classNames={ERROR_CLASSES}
                  spellCheck={false}
                  autoCapitalize="off"
                />
                <TextInput
                  label="Address"
                  description="One line, which is the street the card carries"
                  value={card.address}
                  onChange={(event) => editCard({ address: event.currentTarget.value })}
                />
              </Row>
              <Textarea
                label="Note"
                value={card.note}
                onChange={(event) => editCard({ note: event.currentTarget.value })}
                autosize
                minRows={2}
                maxRows={6}
              />
            </>
          )}

          {kind === "email" && (
            <>
              <Row error={mailError}>
                <TextInput
                  label="Email address"
                  placeholder="someone@example.com"
                  value={mail.address}
                  onChange={(event) => editMail({ address: event.currentTarget.value })}
                  error={mailError}
                  classNames={ERROR_CLASSES}
                  spellCheck={false}
                  autoCapitalize="off"
                />
                <TextInput
                  label="Subject"
                  value={mail.subject}
                  onChange={(event) => editMail({ subject: event.currentTarget.value })}
                />
              </Row>
              <Textarea
                label="Message"
                value={mail.body}
                onChange={(event) => editMail({ body: event.currentTarget.value })}
                autosize
                minRows={3}
                maxRows={10}
              />
            </>
          )}

          {dialling && (
            <Row error={numberError}>
              <TextInput
                label="Phone number"
                placeholder="+44 20 7946 0958"
                value={number}
                onChange={(event) => setNumber(event.currentTarget.value)}
                error={numberError}
                classNames={ERROR_CLASSES}
              />
            </Row>
          )}

          {kind === "sms" && (
            <Textarea
              label="Message"
              value={message}
              onChange={(event) => setMessage(event.currentTarget.value)}
              autosize
              minRows={3}
              maxRows={10}
            />
          )}
        </Stack>
      </Card>

      <Card withBorder shadow="sm" radius="md">
        <Stack>
          <Group justify="space-between">
            <Title order={4}>QR Code</Title>
            {modules && (
              <Group gap="xs">
                <Button
                  size="xs"
                  variant="light"
                  leftSection={<IconDownload size="0.9rem" />}
                  onClick={saveSvg}
                >
                  SVG
                </Button>
                <Button
                  size="xs"
                  variant="light"
                  leftSection={<IconDownload size="0.9rem" />}
                  onClick={savePng}
                >
                  PNG
                </Button>
                <CopyButton value={payload} timeout={2000}>
                  {({ copied, copy }) => (
                    <Tooltip label={copied ? "Copied" : "Copy"} withArrow position="left">
                      <ActionIcon
                        color={copied ? "teal" : "gray"}
                        variant="subtle"
                        onClick={copy}
                        aria-label="Copy encoded text"
                      >
                        {copied ? <IconCheck size="1.2rem" /> : <IconCopy size="1.2rem" />}
                      </ActionIcon>
                    </Tooltip>
                  )}
                </CopyButton>
              </Group>
            )}
          </Group>

          {payload === "" && (
            <Text size="sm" c="dimmed">
              {blocked ? "The code comes back once what is marked above is put right." : KINDS[kind].hint}
            </Text>
          )}

          {payload !== "" && modules === null && (
            <Text size="sm" c="dimmed">
              {fitsLower
                ? "This is more than a code at this level of correction has room for, though a lower one would hold it."
                : "This is longer than any QR code has room for, so there is nothing here a camera could read."}
            </Text>
          )}

          {modules && (
            <Stack align="center" gap="xs" style={{ "--qr-code-width": QR_WIDTH } as CSSProperties}>
              <QrCode modules={modules} label="QR code for the encoded text" />
              <Text size="xs" c="dimmed">
                Version {(modules.length - 17) / 4} · {modules.length}×{modules.length} modules ·{" "}
                {new TextEncoder().encode(payload).length} bytes
              </Text>
            </Stack>
          )}

          {payload !== "" && (
            <Textarea
              value={payload}
              aria-label="Encoded text"
              readOnly
              autosize
              minRows={1}
              maxRows={10}
              spellCheck={false}
              styles={{ input: { fontFamily: "monospace" } }}
            />
          )}
        </Stack>
      </Card>
    </Stack>
  );
}

function Row({ error, children }: RowProps) {
  return (
    <Box className={error ? "settings-row has-error" : "settings-row"} mb={error ? "md" : 0}>
      {children}
    </Box>
  );
}

interface RowProps {
  error?: string | null;
  children: ReactNode;
}

const ERROR_CLASSES = { root: "relative-root", error: "absolute-error" };

const QR_WIDTH = "calc(18rem * var(--mantine-scale))";
