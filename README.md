<p align="center">
  <img src="https://img.shields.io/badge/OculiX_Java_Framework-0.1.0-7c3aed?style=for-the-badge" alt="OculiX Java Framework 0.1.0" />
  <img src="https://img.shields.io/badge/Java-17%2B-007396?style=for-the-badge&logo=openjdk&logoColor=white" alt="Java 17+" />
  <img src="https://img.shields.io/badge/License-MIT-16a34a?style=for-the-badge" alt="MIT License" />
  <img src="https://img.shields.io/badge/Status-WIP-f59e0b?style=for-the-badge" alt="Work In Progress" />
  <br/>
  <img src="https://img.shields.io/badge/Built_on-OculiX-1ABC9C?style=flat-square" alt="OculiX" />
  <img src="https://img.shields.io/badge/Logging-SLF4J-blue?style=flat-square" alt="SLF4J" />
  <img src="https://img.shields.io/badge/JSON-Jackson-orange?style=flat-square" alt="Jackson" />
  <img src="https://img.shields.io/badge/Tests-JUnit_5-25A162?style=flat-square&logo=junit5&logoColor=white" alt="JUnit 5" />
</p>

<h1 align="center">🦎 OculiX Java Framework</h1>

<p align="center">
  <i>The Manager-based companion to OculiX, on the Java side.</i><br/>
  <i>Page Objects, preflight checks, recordings, OCR, parallel VNC &mdash;
  everything you actually need to ship a real visual-automation suite.</i>
</p>

---

## Why this exists

OculiX (the SikuliX continuation) gives you a fantastic low-level visual-automation API: `Screen`, `Region`, `find()`, `click()`, `type()`. That's the *primitive layer* &mdash; small, sharp, exactly the right size for what it does.

But once you start writing a real test suite &mdash; dozens of pages, hundreds of images, parallel runs, OCR with retries, smart waits, before/after captures, GIF recordings of failing scenarios &mdash; you find yourself reinventing the same scaffolding every time. Page Object Pattern. Preflight resource checks. Centralised wait strategies. A drag/drop helper that doesn't fight VNC latency. A capture system that doesn't fill the disk.

This framework is that scaffolding, factored out and donated to OSS. The **Manager** pattern wraps OculiX with seven specialised orchestrators (`ScreenOperationsManager`, `ClickManager`, `TypeManager`, `WaitManager`, `OCRManager`, `RegionManager`, `CaptureManager`) and adds the pieces that real-world parallel runs need: VNC port allocation, OCR-driven grid navigation, streaming GIF recordings, post-mortem captures on assertion failure.

It works transparently against a local `Screen` and a `VNCScreen` &mdash; same code, different target.

## Quick start

### 1. Add the dependency

```xml
<dependency>
    <groupId>io.github.oculix-org</groupId>
    <artifactId>oculix-java-framework</artifactId>
    <version>0.1.0</version>
</dependency>
```

The framework transitively pulls the latest OculiX release from Maven Central (`[3.0.4,)` version range &mdash; no manual bump when OculiX ships a new version).

### 2. Write your first test

```java
import com.oculix.framework.managers.ScreenOperationsManager;

public class HelloOculix {
    public static void main(String[] args) {
        ScreenOperationsManager sm = new ScreenOperationsManager();

        sm.waitForElement("login_button.png", 5);
        sm.clickOn("login_button.png");
        sm.typeText("alice");
        sm.typeTextWithEnter("s3cret");

        if (sm.waitForText("Welcome", 10)) {
            System.out.println("Login worked.");
        }
    }
}
```

### 3. Run it

```bash
mvn install
mvn exec:java -Dexec.mainClass=HelloOculix
```

That's it. No SikuliX IDE in the loop, no Eclipse setup gymnastics, no shaded fat jar to download by hand. Just Maven and Java.

## The Manager architecture

Seven specialised classes, each with a single responsibility. They communicate through a shared `ThreadLocal<Region>` so every operation targets the right screen automatically &mdash; per-thread isolation for parallel runs, transparently.

You never have to instantiate the six sub-managers yourself: `ScreenOperationsManager` composes them at construction time and exposes their public methods at the top level for convenience. Use the top-level API for casual scripts; reach into the individual Managers when you want fine-grained control (custom backends, alternative loggers, mocking in tests).

### 🧱 `ScreenOperationsConfig` &mdash; the bedrock that starts before everything else

Abstract parent of `ScreenOperationsManager`. You never instantiate it directly, and you never call into it from your test code &mdash; but it's the engine room that makes everything actually work.

**Responsibilities** (all internal to the framework):

- Initialises SikuliX with tuned performance settings learned the hard way: `MoveMouseDelay=0` (cursors don't need to drift across the screen at YouTube-tutorial pace), `WaitScanRate=15` (3 scans per second is fine for a developer on Monday morning, not for a CI test framework), `ActionLogs=false` + `InfoLogs=false` (SikuliX, left to its own devices, produces industrial-grade log volumes on topics no one asked about), `CheckLastSeen=false` (fresh captures, not memories).
- Holds the shared `ThreadLocal<Region> screenHolder` that every Manager uses to target the right screen, automatically, per-thread.
- Bundles an inner singleton `RunConfiguration` that auto-detects the project root (walks up the file tree looking for a `.prj` marker), resolves every property via **system property &gt; environment variable &gt; auto-detection &gt; default**, and feeds the Managers their paths, timeouts, and feature flags. Internal &mdash; not user API.

**The one public method you might actually use**:

```java
import com.oculix.framework.config.ScreenOperationsConfig;

if (ScreenOperationsConfig.isVNCModeStatic()) {
    // You're driving a remote VNCScreen — adjust your strategy accordingly
    // (longer waits, smaller capture regions, fewer concurrent flows).
}
```

That's it. Everything else &mdash; project paths, report folders, timeouts, all the ~60 properties of `RunConfiguration` &mdash; is consumed by the framework on your behalf. You pass image paths and waits to the Managers; the rest is plumbing.

### 🎛️ `ScreenOperationsManager` &mdash; the orchestrator

The entry point. Holds the screen reference (local `Screen` or `VNCScreen`), composes the six sub-managers, applies OculiX performance settings, exposes a flat top-level API that delegates to the right Manager under the hood.

**Two constructors**:

```java
// Local mode &mdash; current display
ScreenOperationsManager sm = new ScreenOperationsManager();

// Headless / remote VNC mode
ScreenOperationsManager sm = new ScreenOperationsManager(
    "vnc-host.example.com",  // host
    5901,                    // port
    10,                      // connect timeout (s)
    300                      // operation timeout (s)
);
```

**Inherits from `ScreenOperationsConfig`** which auto-detects the project directory (walks the file tree for a `.prj` marker), provides multi-source resolution (system property &gt; env var &gt; default), and applies the tuned SikuliX settings (`MoveMouseDelay=0`, `WaitScanRate=15`, etc.).

Also bundles a self-contained `KeywordUtil` logger with timestamped levels (INFO / PASS / WARN / ERROR / FAIL / STOP) for callers who prefer that style to raw SLF4J.

### 🖱️ `ClickManager` &mdash; click, double-click, hover, near-image

Every click variant you actually need on a real screen.

**Key methods**:

```java
sm.clickOn("login_button.png");                          // simple click
sm.clickOn("login_button.png", 0.92);                    // with similarity threshold
sm.doubleClickOn("file_icon.png");                       // double-click + highlight
sm.hoverOn("tooltip_anchor.png");                        // hover to reveal a tooltip
sm.clickTopRightOfImage();                               // close button on active window
sm.clickNearImage("anchor.png", 0.95, 40, "right");     // click 40px to the right
sm.clickAndTypeNearImage("label.png", "Hello", 0.9, 30, "right");
```

The `clickNearImage(anchor, sim, offset, "left|right|up|down")` is what you reach for when the actual target has no stable visual signature &mdash; you anchor on a nearby label instead.

### ⌨️ `TypeManager` &mdash; keyboard input that respects credentials

Typing, paste, insert-into-image-anchor. Every input call wraps the underlying SikuliX `type()` in a silenced-logs block so credentials, tokens, and PII never leak to stdout (you'd be surprised how often raw SikuliX logs end up in CI artefacts).

**Key methods**:

```java
sm.typeText("Hello");                                    // type into focused field
sm.typeTextWithEnter("username");                        // type then send ENTER
sm.pasteText(longPayload);                               // clipboard paste (faster than type for big strings)
sm.insertText("username_field.png", "alice");           // click the image first, then type
```

Pasting is dramatically faster than typing for long strings &mdash; use `pasteText()` for anything beyond a short password.

### ⏳ `WaitManager` &mdash; waits, assertions, presence/absence

The wait toolkit that turns flaky tests into reliable ones. Supports pattern-based waits with similarity, batch waits, screen-stability detection, and "wait then click" composites that swallow the standard race conditions.

**Key methods**:

```java
sm.waitForElement("login.png", 10);                      // wait up to 10s
sm.waitForElement("login.png", 10, /*silent=*/true);    // no log on miss
sm.waitForElement("login.png", 10, 0.95);                // with similarity
sm.waitForAllImages(List.of("a.png", "b.png", "c.png"), 15, /*requireAll=*/true);
sm.waitForScreenStable(800, 5000);                       // stable 800ms, max 5s
sm.waitForImageToDisappear("spinner.png", 30, 0.9);     // vanish wait
sm.waitUntilElementVisibleAndClick("submit.png", 10, 0.9);
sm.assertElementPresent("logo.png", 5, "Logo missing");
sm.verifyImageNotPresent("error_banner.png");
```

`waitForScreenStable()` is gold for pages with async rendering &mdash; it captures, sleeps 300ms, captures again, compares with similarity 0.99, and returns when nothing has changed for the requested stable window. No more "click before the page finished loading" race.

### 🔤 `OCRManager` &mdash; text detection, click-on-text, label/value pairs

OCR-driven operations when you can't anchor on an image. Supports plain Tesseract (via OculiX) and an optional PaddleOCR HTTP backend for higher accuracy on multilingual or screen-of-the-1990s content.

**Key methods**:

```java
sm.waitForText("Order confirmed", 15);                   // OCR wait
sm.waitForText("Loaded", 10, /*leftHalf=*/true);        // limit search to left half
sm.waitForTextVanish("Loading...", 30);                  // wait for text to disappear
sm.waitForTextAndClick("Settings", 10, true);            // wait then click
sm.clickOnText("Save");                                  // direct click on first match
sm.detectTextPairInActiveApp("Invoice #4242", "129.90", 5);  // label + value on same row
sm.waitForTextInRegion(headerRegion, "Welcome");         // OCR scoped to a region
```

`detectTextPairInActiveApp(label, value, toleranceY)` is the killer feature for table-row validation: it finds the label and the value on the same screen row (within a pixel tolerance), and generates numeric variants of the value (decimal separators, padded forms, cent-to-unit conversion) to absorb OCR noise. Originally built for transactional UIs where the same number can appear as `129,90` / `129.90` / `12990` depending on the rendering layer.

### 🗺️ `RegionManager` &mdash; geometry, scrolling, grid navigation

Region-relative operations: search a region below/around an anchor, scroll-and-find with image *or* OCR target, extract text near an anchor, navigate a table grid by row/column header.

**Key methods**:

```java
Region below = sm.findRegionBelow("section_header.png", 200);
Region validated = sm.validateRegion("anchor.png", "Anchor missing", 200);
sm.performScrollAndFind("scrollable_anchor.png", "target_item.png", 100, 20, "DOWN");
sm.performScrollAndFindText("table_header.png", "Widget-42", 100, 20);
sm.scrollVerticallyFromLeft(0.1, 0.4, /*directionUp=*/false);
String extracted = sm.extractTextNearImage("price_label.png", 0.95, 200);
sm.clickOnInputByRowAndColumn("Article", "Widget-42", "Quantity");
```

`clickOnInputByRowAndColumn(uniqueColumn, rowText, columnHeaderText)` reads the screen via OCR, locates the row (by content) and the target column (by header label), and clicks at their intersection &mdash; without ever needing fixed coordinates. It survives layout shifts, language changes, resolution changes, font-size tweaks, dynamic column ordering. The single most expressive method in the framework.

### 📸 `CaptureManager` &mdash; screenshots, annotations, GIF recordings

The capture toolkit you wish JUnit shipped with. Plain captures, annotated captures, capture-when-stable, error post-mortems with sidecar stacktraces, and **streaming GIF recordings** that don't fill RAM.

**Key methods**:

```java
sm.captureScreen("reports/login_done.png");
cm.captureRegion(loginPanel, "reports/login_panel.png");
cm.captureWithHighlight(activeScreen, errorBanner, "reports/error_highlight.png");
cm.captureWithCrosshair(loginPanel, clickPoint, "reports/click_location.png");
cm.captureWithAnnotation(loginPanel, "Step 3: submit button", "reports/step3.png");
cm.captureUntilStable(loginPanel, 800, 5000, "reports/stable_login.png");
cm.captureOnError(thrownException, "step_authenticate");  // PNG + sidecar .txt
String b64 = cm.captureToBase64(loginPanel);             // ready to drop into HTML reports
```

**Streaming GIF recordings** with `TestRecorder`:

```java
TestRecorder rec = cm.startRecording(loginPanel, "reports/login_flow.gif");
// ... run the test (frames written to disk as captured &mdash; bounded RAM)
String savedPath = rec.stop();
```

Default playback speed is `TestRecorder.THAMES_MODE = 4.0` &mdash; a 60-second test plays back in 15. Set `speedup=10.0` for the full Yakety experience (Yakety Axe, Chet Atkins, 1965, since you ask):

```java
cm.startRecording(loginPanel, "reports/login_flow.gif", 200, 10.0);
```

The encoder writes each frame straight to the GIF stream &mdash; you can record for hours without buffering a single full sequence.

## What you actually get out of the box

### Page Object Pattern, the visual way

Each page becomes a class. Its images live next to it. Refactors stop being treasure hunts:

```java
public class LoginPage {
    private final ScreenOperationsManager sm;

    public LoginPage(ScreenOperationsManager sm) { this.sm = sm; }

    public void enterCredentials(String user, String pass) {
        sm.waitForElement("img/login/username_field.png", 5);
        sm.clickOn("img/login/username_field.png");
        sm.typeText(user);
        sm.clickOn("img/login/password_field.png");
        sm.typeTextWithEnter(pass);
    }
}
```

### Recordings, post-mortems, annotated captures

Streaming GIF recordings (bounded RAM, no matter how long the run), post-mortem captures on assertion failure with sidecar stacktraces, plain captures with overlays (highlight box, crosshair, annotation banner). See [`CaptureManager`](#-capturemanager--screenshots-annotations-gif-recordings) above for the full method set.

### OCR with retries, vanish detection, and grid navigation

```java
sm.waitForText("Order confirmed", 15);
sm.waitForTextVanish("Loading...", 30);
sm.clickOnText("Settings");

// Click on the "Quantity" cell of the row containing "Widget-42":
sm.clickOnInputByRowAndColumn("Article", "Widget-42", "Quantity");
```

### OCR backend, your choice

Default is Tesseract via OculiX (bundled, no install). For higher accuracy on multilingual or screen-of-the-1990s use cases, the framework ships a `PaddleOCRHttpClient` that talks to a local Python server (`paddleocrserver-powered`, installed automatically at build time by the Maven `exec-maven-plugin`).

You can also point the client at a remote PaddleOCR server, or skip the auto-install entirely with the `skip-paddleocr` profile:

```bash
mvn install -Pskip-paddleocr
```

### Parallel VNC: same code, more screens

Every Manager uses a `ThreadLocal<Region>` for its screen reference. Spawn one `ScreenOperationsManager` per thread, point each at a different `VNCScreen`, and your suite runs in parallel without a single global to fight over. Five times the throughput on the same VM &mdash; see the [parallel VNC retrospective](https://oculix.org/blog/2026-05-22-five-times-faster-parallel-vnc/) for the story.

## Configuration

### Logging

The framework logs via SLF4J. Drop a `logback.xml` in your `src/main/resources/`:

```xml
<configuration>
    <appender name="STDOUT" class="ch.qos.logback.core.ConsoleAppender">
        <encoder>
            <pattern>%d{HH:mm:ss.SSS} [%level] [%thread] %logger{0} - %msg%n</pattern>
        </encoder>
    </appender>
    <root level="info">
        <appender-ref ref="STDOUT" />
    </root>
</configuration>
```

### PaddleOCR server

After `mvn install`, the `paddleocrserver-powered` command is in your PATH (installed via `pip install --user`). The Java client launches it automatically when no server is running on `localhost:5000`.

Override the launch command (for instance to use a venv binary or a remote server):

```java
PaddleOCRHttpClient.setServerStartCommand("/path/to/venv/bin/paddleocrserver-powered");
```

### Project directory auto-detection

`ScreenOperationsConfig.RunConfiguration` walks up the file tree looking for a `.prj` marker file to locate the project root. Override via system property (`-Dproject.dir=/path`) or environment variable (`PROJECT_DIR=/path`).

## Roadmap

This is `v0.1.0` &mdash; the first public version, brought out of years of private utilities into the open. Coming next:

- 📚 **A real `examples/` directory** with worked Page Object patterns
- 🧪 **Preflight resource check** &mdash; scan every referenced image at startup and fail fast if anything is missing
- 🖼️ **Live test-runner UX** &mdash; a Swing thread showing the image currently being waited on or clicked, with a countdown
- 🐍 **`oculix-companion-app`** (separate repo) &mdash; the image-management plugin Raimund Hocke dreamt of, for IntelliJ / Eclipse / PyCharm / VSCode
- 🚀 **First-class parallel VNC** &mdash; making the multi-session pattern native to the OculiX core itself

The discussion lives in [#397](https://github.com/oculix-org/Oculix/discussions/397) and [#398](https://github.com/oculix-org/Oculix/discussions/398) on the OculiX repo. PRs, issues, and write access requests welcome.

## Contributing

This repo is intentionally a **GitHub template** (clone or "Use this template" to start your own). It's also a real OSS library you can depend on via Maven.

- Issues: feature requests, bug reports, edge cases hit in your suite
- Discussions: design choices, naming, where the framework should grow next
- PRs: very welcome, especially with worked examples and tests

The maintainers ([@RaiMan](https://github.com/RaiMan), [@adriancostin6](https://github.com/adriancostin6), [@julienmerconsulting](https://github.com/julienmerconsulting)) review actively.

## License & acknowledgements

MIT. Built on [OculiX](https://github.com/oculix-org/Oculix) (the SikuliX continuation, maintained by [@RaiMan](https://github.com/RaiMan) since 2010 and the community since). PaddleOCR backend powered by [Baidu PaddleOCR](https://github.com/PaddlePaddle/PaddleOCR) via the [`paddleocrserver-powered`](https://pypi.org/project/paddleocrserver-powered/) pypi package. Logging via [SLF4J](https://www.slf4j.org/) and [Logback](https://logback.qos.ch/). JSON via [Jackson](https://github.com/FasterXML/jackson).

If you use this framework on real production work, drop a star or open an issue saying so &mdash; nothing fancy, just helpful to know the thing is alive.

🦎
