import { ActionIcon, Box, Button, Card, CopyButton, Group, Modal, NumberInput, SegmentedControl, Select, Stack, Text, Textarea, TextInput, Title, Tooltip } from "@mantine/core";
import { type CSSProperties, useEffect, useState } from "react";
import { INSTANT_PICKER_WIDTH, InstantPicker } from "../../common/instant-picker";
import { useInitialHashState, useRegisterShareState } from "../../common/share-state";
import { UtilityTitle } from "../../common/utility-title";
import { IconCheck, IconCopy, IconQrcode, IconRefresh } from "../../icons";
import { computeCode } from "./compute";
import type { Algorithm } from "./hotp";
import { DEFAULT_SUITE, parseSuite, questionNoun, questionProblem, sessionProblem, type Suite } from "./ocra";
import { QR_QUIET_ZONE, qrModules, qrPath } from "./qr";
import { generateSecret, pickSecretFormat, SECRET_FORMATS, type SecretFormat, secretProblem } from "./secret";
import { ALGORITHM_OPTIONS, clampWhole, COUNTER_RANGE, DIGIT_RANGE, hashLabel, MAX_COUNTER, MAX_TIME, type Mode, MODE_OPTIONS, MODES, parseWhole, PERIOD_RANGE, pickAlgorithm, pickMode, pickText, pickTextOr, SECRET_SIZES, TIME_RANGE } from "./settings";
import { DEFAULT_ISSUER, DEFAULT_LABEL, readUri, type UriFields, uriKeyless, writeUri } from "./uri";

export default function Otp() {
  const initialState = useInitialHashState<{
    mode?: string;
    issuer?: string;
    label?: string;
    secret?: string;
    format?: string;
    algorithm?: string;
    digits?: number;
    period?: number;
    counter?: number;
    time?: number;
    suite?: string;
    question?: string;
    password?: string;
    session?: string;
  }>();

  const [mode, setMode] = useState<Mode>(pickMode(initialState?.mode));
  const [issuer, setIssuer] = useState(pickTextOr(initialState?.issuer, DEFAULT_ISSUER));
  const [label, setLabel] = useState(pickTextOr(initialState?.label, DEFAULT_LABEL));
  const [secret, setSecret] = useState(pickText(initialState?.secret));
  const [format, setFormat] = useState<SecretFormat>(pickSecretFormat(initialState?.format));
  const [algorithm, setAlgorithm] = useState<Algorithm>(pickAlgorithm(initialState?.algorithm));
  const [digits, setDigits] = useState<number | string>(clampWhole(initialState?.digits, DIGIT_RANGE, 6));
  const [period, setPeriod] = useState<number | string>(clampWhole(initialState?.period, PERIOD_RANGE, 30));
  const [counter, setCounter] = useState<number | string>(clampWhole(initialState?.counter, COUNTER_RANGE, 0));
  const [time, setTime] = useState<number | string>(typeof initialState?.time === "number" ? initialState.time : "");
  const [suiteText, setSuiteText] = useState(initialState?.suite ? pickText(initialState.suite) : DEFAULT_SUITE);
  const [question, setQuestion] = useState(pickText(initialState?.question));
  const [password, setPassword] = useState(pickText(initialState?.password));
  const [session, setSession] = useState(pickText(initialState?.session));
  const [now, setNow] = useState(() => Date.now());
  const [uriDraft, setUriDraft] = useState<UriDraft | null>(null);
  const [scanning, setScanning] = useState(false);
  const [asked, setAsked] = useState(false);

  const reading = mode === "ocra" ? readSuite(suiteText) : NO_SUITE;
  const suite = reading.suite;
  const live = time === "";
  const parsedTime = live ? null : parseWhole(time, TIME_RANGE);
  const seconds = live ? Math.floor(now / 1000) : parsedTime;
  const instant = seconds === null ? null : new Date(seconds * 1000);
  const stepSeconds = mode === "totp" ? parseWhole(period, PERIOD_RANGE) ?? 0 : suite?.step ?? 0;

  useEffect(() => {
    if (!live || stepSeconds === 0) return;
    let timer = 0 as unknown as ReturnType<typeof setTimeout>;
    const tick = () => {
      setNow(Date.now());
      timer = setTimeout(tick, 1000 - (Date.now() % 1000));
    };
    timer = setTimeout(tick, 1000 - (Date.now() % 1000));
    return () => clearTimeout(timer);
  }, [live, stepSeconds]);

  useRegisterShareState(() => ({
    mode,
    issuer: mode === "ocra" ? undefined : issuer,
    label: mode === "ocra" ? undefined : label,
    secret: secret || undefined,
    format,
    algorithm: mode === "ocra" ? undefined : algorithm,
    digits: mode === "ocra" ? undefined : digits,
    period: mode === "totp" ? period : undefined,
    counter: mode === "hotp" || suite?.counter ? counter : undefined,
    time: stepSeconds > 0 && !live ? time : undefined,
    suite: mode === "ocra" ? suiteText : undefined,
    question: suite ? question || undefined : undefined,
    password: suite?.password ? password || undefined : undefined,
    session: suite?.session ? session || undefined : undefined,
  }));

  const secretIssue = secretProblem(secret, format);
  const secretError = secretIssue ?? (asked && !secret ? "Required" : null);
  const digitsError = parseWhole(digits, DIGIT_RANGE) === null
    ? `Enter a digit count between ${DIGIT_RANGE.min} and ${DIGIT_RANGE.max}`
    : null;
  const periodError = parseWhole(period, PERIOD_RANGE) === null
    ? `Enter a period between ${PERIOD_RANGE.min} and ${PERIOD_RANGE.max} seconds`
    : null;
  const counterError = parseWhole(counter, COUNTER_RANGE) === null ? "Enter a whole counter value" : null;
  const timeError = live || parsedTime !== null ? null : "Enter a time in epoch seconds";
  const questionIssue = suite ? questionProblem(question, suite) : null;
  const questionError = questionIssue ?? (asked && suite && !question ? "Required" : null);
  const sessionError = suite ? sessionProblem(session, suite) : null;

  const result = computeCode({
    mode,
    secret,
    format,
    algorithm,
    digits: parseWhole(digits, DIGIT_RANGE),
    period: parseWhole(period, PERIOD_RANGE),
    counter: parseWhole(counter, COUNTER_RANGE),
    seconds,
    suite,
    question,
    password,
    session,
  });

  const remaining = live && stepSeconds > 0 && seconds !== null ? stepSeconds - (seconds % stepSeconds) : null;

  const uriFields: UriFields = {
    mode: mode === "hotp" ? "hotp" : "totp",
    issuer,
    label,
    secret,
    format,
    algorithm,
    digits: parseWhole(digits, DIGIT_RANGE),
    period: parseWhole(period, PERIOD_RANGE),
    counter: parseWhole(counter, COUNTER_RANGE),
  };
  const uri = writeUri(uriFields);
  const showingDraft = uriDraft !== null && uriDraft.against === uri;
  const uriText = showingDraft ? uriDraft.text : uri;
  const uriError = showingDraft ? uriDraft.error : null;

  const changeMode = (value: string) => {
    setMode(pickMode(value));
    setAsked(false);
  };

  const editUri = (text: string) => {
    const next = readUri(text, uriFields);
    if (next) applyUri(next);
    setUriDraft({
      text,
      against: next ? writeUri(next) : uri,
      error: next ? null : "A URI here opens otpauth://totp/ or otpauth://hotp/",
    });
  };

  const applyUri = (next: UriFields) => {
    if (next.mode !== mode) setAsked(false);
    setMode(next.mode);
    setIssuer(next.issuer);
    setLabel(next.label);
    setSecret(next.secret);
    setFormat(next.format);
    setAlgorithm(next.algorithm);
    if (next.digits !== null) setDigits(next.digits);
    if (next.period !== null) setPeriod(next.period);
    if (next.counter !== null) setCounter(next.counter);
  };

  const generate = () => setSecret(generateSecret(format, SECRET_SIZES[suite?.algorithm ?? algorithm]));

  const nextCode = () => setCounter((current) => Math.min((parseWhole(current, COUNTER_RANGE) ?? -1) + 1, MAX_COUNTER));

  return (
    <Stack gap="md">
      <Group justify="space-between" align="center" wrap="nowrap">
        <UtilityTitle directory="otp">{MODES[mode].title}</UtilityTitle>
        <SegmentedControl
          value={mode}
          onChange={changeMode}
          aria-label="Which one-time password"
          data={MODE_OPTIONS}
        />
      </Group>

      <Card withBorder shadow="sm" radius="md">
        <Stack>
          <Box className={secretError ? "settings-row has-error" : "settings-row"} mb={secretError ? "md" : 0}>
            <TextInput
              label="Secret"
              description="The key both sides share, which never leaves this tab"
              placeholder="e.g. JBSWY3DPEHPK3PXP"
              value={secret}
              onChange={(event) => setSecret(event.currentTarget.value)}
              error={secretError}
              spellCheck={false}
              classNames={{ root: "relative-root", error: "absolute-error" }}
              styles={{ input: { fontFamily: "monospace" } }}
              rightSectionPointerEvents="all"
              rightSection={
                <Tooltip label="Generate a secret" withArrow position="left">
                  <ActionIcon
                    color="gray"
                    variant="subtle"
                    onClick={generate}
                    aria-label="Generate a secret"
                  >
                    <IconRefresh size="1.1rem" />
                  </ActionIcon>
                </Tooltip>
              }
            />
            <Select
              label="Secret Format"
              data={SECRET_FORMATS}
              value={format}
              onChange={(value) => setFormat(pickSecretFormat(value))}
              allowDeselect={false}
            />
          </Box>

          {mode !== "ocra" && (
            <Box className="settings-row">
              <TextInput
                label="Issuer"
                description="Who the code is for, which is what an authenticator files it under"
                value={issuer}
                onChange={(event) => setIssuer(event.currentTarget.value)}
                spellCheck={false}
              />
              <TextInput
                label="Label"
                description="Which account it is, beside the issuer in that same list"
                value={label}
                onChange={(event) => setLabel(event.currentTarget.value)}
                spellCheck={false}
              />
            </Box>
          )}

          {mode !== "ocra" && (
            <Box
              className={digitsError || counterError ? "settings-row has-error" : "settings-row"}
              mb={digitsError || counterError ? "md" : 0}
            >
              <Select
                label="Algorithm"
                data={ALGORITHM_OPTIONS}
                value={algorithm}
                onChange={(value) => setAlgorithm(pickAlgorithm(value))}
                allowDeselect={false}
              />
              <NumberInput
                label="Digits"
                value={digits}
                onChange={setDigits}
                min={DIGIT_RANGE.min}
                max={DIGIT_RANGE.max}
                allowDecimal={false}
                allowNegative={false}
                error={digitsError}
                classNames={{ root: "relative-root", error: "absolute-error" }}
              />
              {mode === "hotp" && (
                <NumberInput
                  label="Counter"
                  description="Stepped once per code the token hands out"
                  value={counter}
                  onChange={setCounter}
                  min={0}
                  max={MAX_COUNTER}
                  allowDecimal={false}
                  allowNegative={false}
                  stepHoldDelay={500}
                  stepHoldInterval={(t) => Math.max(1000 / t ** 2, 75)}
                  error={counterError}
                  classNames={{ root: "relative-root", error: "absolute-error" }}
                />
              )}
            </Box>
          )}

          {mode === "totp" && (
            <Box
              className={periodError || timeError ? "settings-row has-error" : "settings-row"}
              mb={periodError || timeError ? "md" : 0}
            >
              <NumberInput
                label="Period"
                description="Seconds each code is good for"
                value={period}
                onChange={setPeriod}
                min={PERIOD_RANGE.min}
                max={PERIOD_RANGE.max}
                allowDecimal={false}
                allowNegative={false}
                error={periodError}
                classNames={{ root: "relative-root", error: "absolute-error" }}
              />
              <TimeInput value={time} onChange={setTime} error={timeError} instant={instant} live={live} />
            </Box>
          )}

          {mode === "ocra" && (
            <TextInput
              label="Suite"
              description="What the two sides agreed to compute, and part of the message itself"
              placeholder={DEFAULT_SUITE}
              value={suiteText}
              onChange={(event) => setSuiteText(event.currentTarget.value)}
              error={reading.error}
              spellCheck={false}
              styles={{ input: { fontFamily: "monospace" } }}
            />
          )}

          {suite && (
            <>
              <Box
                className={questionError || counterError ? "settings-row has-error" : "settings-row"}
                mb={questionError || counterError ? "md" : 0}
              >
                <TextInput
                  label="Question"
                  description={`The challenge, up to ${suite.question.length} ${questionNoun(suite.question.format)}`}
                  value={question}
                  onChange={(event) => setQuestion(event.currentTarget.value)}
                  error={questionError}
                  spellCheck={false}
                  classNames={{ root: "relative-root", error: "absolute-error" }}
                  styles={{ input: { fontFamily: "monospace" } }}
                />
                {suite.counter && (
                  <NumberInput
                    label="Counter"
                    description="Stepped once per code the token hands out"
                    value={counter}
                    onChange={setCounter}
                    min={0}
                    max={MAX_COUNTER}
                    allowDecimal={false}
                    allowNegative={false}
                    stepHoldDelay={500}
                    stepHoldInterval={(t) => Math.max(1000 / t ** 2, 75)}
                    error={counterError}
                    classNames={{ root: "relative-root", error: "absolute-error" }}
                  />
                )}
              </Box>

              {(suite.password || suite.session !== 0) && (
                <Box
                  className={sessionError ? "settings-row has-error" : "settings-row"}
                  mb={sessionError ? "md" : 0}
                >
                  {suite.password && (
                    <TextInput
                      label="PIN or password"
                      description={`Hashed with ${hashLabel(suite.password)} before it is counted, as the suite asks`}
                      value={password}
                      onChange={(event) => setPassword(event.currentTarget.value)}
                      spellCheck={false}
                    />
                  )}
                  {suite.session !== 0 && (
                    <TextInput
                      label="Session information"
                      description={`What this exchange is about, up to ${suite.session} bytes`}
                      value={session}
                      onChange={(event) => setSession(event.currentTarget.value)}
                      error={sessionError}
                      spellCheck={false}
                      classNames={{ root: "relative-root", error: "absolute-error" }}
                    />
                  )}
                </Box>
              )}

              {suite.step !== 0 && (
                <Box className={timeError ? "settings-row has-error" : "settings-row"} mb={timeError ? "md" : 0}>
                  <TimeInput value={time} onChange={setTime} error={timeError} instant={instant} live={live} />
                </Box>
              )}
            </>
          )}

          {mode !== "ocra" && (
            <Textarea
              label="URI"
              description="What an authenticator is enrolled with, which is the fields above and writes them back"
              value={uriText}
              onChange={(event) => editUri(event.currentTarget.value)}
              error={uriError}
              autosize
              minRows={2}
              maxRows={4}
              spellCheck={false}
              styles={{ input: { fontFamily: "monospace" } }}
              rightSectionWidth={URI_ACTIONS_WIDTH}
              rightSectionProps={{ style: { alignItems: "flex-start", paddingTop: "var(--mantine-spacing-xs)" } }}
              rightSectionPointerEvents="all"
              rightSection={
                <Group gap={2} wrap="nowrap">
                  <CopyButton value={uriText} timeout={2000}>
                    {({ copied, copy }) => (
                      <Tooltip label={copied ? "Copied" : "Copy the URI"} withArrow position="left">
                        <ActionIcon
                          color={copied ? "teal" : "gray"}
                          variant="subtle"
                          onClick={copy}
                          aria-label="Copy the URI"
                        >
                          {copied ? <IconCheck size="1.1rem" /> : <IconCopy size="1.1rem" />}
                        </ActionIcon>
                      </Tooltip>
                    )}
                  </CopyButton>
                  <Tooltip label="Show the QR code" withArrow position="left">
                    <ActionIcon
                      color="gray"
                      variant="subtle"
                      onClick={() => setScanning(true)}
                      aria-label="Show the QR code"
                    >
                      <IconQrcode size="1.1rem" />
                    </ActionIcon>
                  </Tooltip>
                </Group>
              }
            />
          )}

          <Group justify="flex-end">
            {mode === "hotp" && <Button variant="default" onClick={nextCode}>Next</Button>}
            <Button onClick={() => setAsked(true)}>Calculate</Button>
          </Group>
        </Stack>
      </Card>

      {result && (
        <Card withBorder shadow="sm" radius="md">
          <Stack>
            <Group gap="sm" align="baseline">
              <Title order={4}>Code</Title>
              <Text size="sm" c="dimmed">{result.crypto}</Text>
            </Group>

            <Group gap="sm" align="flex-start" wrap="nowrap">
              <Text className="otp-code" data-mac={result.code.length > DIGIT_RANGE.max || undefined} miw={0}>
                {result.code}
              </Text>
              <CopyButton value={result.code} timeout={2000}>
                {({ copied, copy }) => (
                  <Tooltip label={copied ? "Copied" : "Copy"} withArrow position="top">
                    <ActionIcon
                      color={copied ? "teal" : "gray"}
                      variant="subtle"
                      onClick={copy}
                      aria-label="Copy the code"
                    >
                      {copied ? <IconCheck size="1.2rem" /> : <IconCopy size="1.2rem" />}
                    </ActionIcon>
                  </Tooltip>
                )}
              </CopyButton>
            </Group>

            {remaining !== null && (
              <Stack gap={4}>
                <Countdown key={stepSeconds} period={stepSeconds} remaining={remaining} />
                <Text size="sm" c="dimmed">
                  Good for another {remaining} {remaining === 1 ? "second" : "seconds"}
                </Text>
              </Stack>
            )}

            {result.counted.length > 0 && (
              <Group gap="lg">
                {result.counted.map((item) => (
                  <Text key={item.label} size="sm" c="dimmed">
                    {item.label} <Text span ff="monospace" c="dimmed">{item.value}</Text>
                  </Text>
                ))}
              </Group>
            )}
          </Stack>
        </Card>
      )}

      <Modal opened={scanning} onClose={() => setScanning(false)} title="Scan to enrol" centered>
        <QrPanel uri={uriText} />
      </Modal>
    </Stack>
  );
}

function QrPanel({ uri }: QrPanelProps) {
  const modules = qrModules(uri);
  const span = modules === null ? 0 : modules.length + QR_QUIET_ZONE * 2;

  return (
    <Stack gap="md" align="center">
      {modules === null
        ? (
          <Text size="sm" c="dimmed" ta="center">
            This URI is longer than any QR code has room for, so there is nothing here a camera could read.
          </Text>
        )
        : (
          <Box className="otp-qr">
            <svg
              viewBox={`0 0 ${span} ${span}`}
              role="img"
              aria-label="QR code for the URI"
              shapeRendering="crispEdges"
            >
              <path d={qrPath(modules)} fill="#000" />
            </svg>
          </Box>
        )}

      <Text size="xs" c="dimmed" ff="monospace" style={{ wordBreak: "break-all" }}>{uri}</Text>

      {uriKeyless(uri) && (
        <Text size="sm" c="dimmed" ta="center">
          There is no secret in this URI, so what it enrols is an account with no key behind it.
        </Text>
      )}
    </Stack>
  );
}

interface QrPanelProps {
  uri: string;
}

function Countdown({ period, remaining }: CountdownProps) {
  const [elapsed] = useState(() => (Date.now() / 1000) % period);

  return (
    <Box
      className="otp-countdown"
      data-low={remaining <= LOW_SECONDS || undefined}
      style={{ "--otp-remaining": remaining / period } as CSSProperties}
    >
      <Box
        className="otp-countdown-bar"
        style={{ "--otp-period": `${period}s`, "--otp-elapsed": `-${elapsed}s` } as CSSProperties}
      />
    </Box>
  );
}

interface CountdownProps {
  period: number;
  remaining: number;
}

function TimeInput({ value, onChange, error, instant, live }: TimeInputProps) {
  return (
    <NumberInput
      label="Time"
      description="Epoch seconds, or the clock while it is empty"
      placeholder="Following the clock"
      value={value}
      onChange={onChange}
      min={0}
      max={MAX_TIME}
      allowDecimal={false}
      allowNegative={false}
      error={error}
      classNames={{ root: "relative-root", error: "absolute-error" }}
      rightSectionWidth={INSTANT_PICKER_WIDTH}
      rightSection={
        <InstantPicker
          instant={instant}
          live={live}
          onPick={(picked) => onChange(Math.floor(picked.getTime() / 1000))}
          onPin={() => onChange(Math.floor(Date.now() / 1000))}
          onClear={() => onChange("")}
        />
      }
    />
  );
}

interface UriDraft {
  text: string;
  against: string;
  error: string | null;
}

interface TimeInputProps {
  value: number | string;
  onChange: (value: number | string) => void;
  error: string | null;
  instant: Date | null;
  live: boolean;
}

function readSuite(text: string): { suite: Suite | null; error: string | null } {
  try {
    return { suite: parseSuite(text), error: null };
  } catch (error) {
    return { suite: null, error: error instanceof Error ? error.message : "This is not a suite" };
  }
}

const NO_SUITE = { suite: null, error: null };

const LOW_SECONDS = 5;

const URI_ACTIONS_WIDTH = 64;
