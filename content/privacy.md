# Privacy Policy: The Tower (PHS Tower app)

**Version 3.1**\
**Effective date:** September 17, 2026\
**Last updated:** September 17, 2026

This Privacy Policy describes how *The Tower*, the student newspaper of Princeton
High School ("The Tower," "we," "us," or "our"), handles information in the
**PHS Tower** mobile app for iOS and Android (the "app"), and for print
subscriptions offered through the app and our website.

The app is published under the bundle/application ID `com.towerphs.phstower`.

If you have any questions about this policy, email
**phstowersenioreditors@gmail.com**.

> **What changed in version 3.1.** We added information about optional print
> subscriptions, external checkout and forms, and subscriber contact and mailing
> details. These records are separate from the app’s on-device account.

> **What changed in version 3.0.** Version 2.0 described an app with no sign-in
> at all. Signing in is back, on completely different terms, and the class
> schedule with it.
>
> You now sign in by confirming a Princeton Public Schools email address, and
> **your account is stored on your phone rather than on our servers**. We do not
> keep a copy: no profile row, no password, not even your email address, which is
> used once to send your code and then forgotten. The class schedule is back on
> the same basis, written to your device and never uploaded.
>
> The account, profile and class-schedule records created under version 1.0 were
> **deleted from our database** on August 10, 2026, not merely hidden. Nothing
> you entered in that version still exists on our side.

---

## 1. The short version

- **You can read the whole paper without signing in.** Signing in is only for
  the class schedule.
- **If you do sign in, your account lives on your phone, not on our servers.**
  We keep no copy of it and no record that you signed in.
- **The app does not create a server-side reader account.** If you choose to
  submit a form or subscribe to the print edition, The Tower receives the
  information you provide, separately from your on-device app account.
- The app is free, contains **no advertising**, and contains **no third-party
  analytics, tracking, or advertising SDKs**.
- We do not request access to your **location, camera, microphone, photo
  library, contacts, calendar, health data, or files**.
- We **do not sell or rent personal information**.
- **Your class schedule never leaves your phone**, and the app never learns
  where you are in the building.

---

## 2. Information we collect

### 2.1 Your account, which we do not keep

Signing in means confirming that you control a Princeton Public Schools email
address. We send a six-digit code to it, check the code, and then forget the
address: the record of your request is deleted the moment you enter the code,
and **no account is created on our servers**.

What the app keeps is held on your phone, in the operating system's secure
storage (the iOS Keychain, or encrypted preferences on Android): a token saying
that somebody confirmed a school address, and the address itself, so the app can
show you which account you are signed in as. The token contains no name and no
identifier that we could trace back to you.

Two things follow from storing it that way, and they are consequences rather
than fine print. Signing in on a second device creates a **separate** account
rather than syncing. And we cannot look up, recover, export or reset your
account, because we have nothing to look it up in.

The app requests no Google permissions and holds no password.

This is a deliberate design constraint rather than a feature that happens to be
missing. Storing identifiable student information on a third-party platform is
what brings an app inside the scope of student-privacy obligations such as
FERPA; the app is built so that there is nothing of the kind to protect.

### 2.2 Your class schedule, and the map that is not coming back

The class schedule is back, and it is stored **only on your phone**. Which
classes you take, and who teaches them, is typed in by you, written to your
device, and read back from it. It is never uploaded, we never receive it, and no
other reader can see it.

What the app downloads is the opposite kind of thing: the school's own bell
times, day types, terms, calendar and staff list. That is institutional
information, identical for every student, and it tells us nothing about you.

The app has **no** access to Princeton Public Schools' student records,
registration systems, or official rosters. The map of the school building was
removed and will not return.

### 2.3 Content you submit to us

**Letter to the Editor** and the **"Join the Tower"** interest form are **Google
Forms** owned by *The Tower*'s own staff account and displayed inside the app.
Responses go to Google and to the Tower's editors; they are covered by Google's
Privacy Policy in addition to this one. They are **never** stored in the app's
database.

Whatever you type into a form is what we receive. The app attaches nothing to
it: no name, no email, no identifier, because it has nothing to attach.

Letters selected for publication may appear in *The Tower* in print or online,
normally under the name you gave on the form. Please do not include information
in a letter that you would not want our editors to read.

### 2.4 Push notification information

The app uses **OneSignal** to deliver push notifications about new issues and
stories. When the app starts, OneSignal registers your device and processes:

- a push token and a OneSignal device identifier,
- basic device information such as device model, operating system version,
  language, and time zone,
- your IP address, from which an approximate (typically country- or
  region-level) location may be derived, and
- a subscription tag we set (`audience = all`) so editors can send general
  announcements.

We use this only to send and route notifications, and to know how many devices
are subscribed. It identifies a **device**, not a person: we have no way to
connect a push token to a student, because we hold no student records to connect
it to. You can decline the notification permission when prompted, or turn
notifications off at any time in your device's system settings for the PHS Tower
app.

### 2.5 Information stored only on your device

The following stay on your device and are never transmitted to us:

- **Saved articles / bookmarks**: stored locally so your reading list works
  offline.
- **Game state**, such as crossword and Minesweeper progress.
- **Cached images and PDF pages**, so the app loads faster and uses less data.

Deleting the app removes all of this local data from your device.

### 2.6 Information collected automatically by our providers

When the app fetches articles, images, issues, or fonts, our
service providers receive ordinary technical information required to serve a
network request, including your **IP address**, device type, and the time of the
request. This happens with:

- **Supabase**, which hosts our article database and article images/PDFs,
- **Google Fonts**, from which the app loads certain typefaces at runtime,
- **Google**, for any Google Form shown in the app, and
- **OneSignal**, as described above.

We do not use this technical information to identify individual readers or
link it to subscription details or form submissions.

### 2.7 Information we do **not** collect

The app never asks for a location permission and contains no location-tracking
code. It does not collect or request GPS or
device location, camera or microphone access, your photos, your contacts, your
calendar, health or fitness data, card details entered at external checkout, browsing
history outside the app, or device identifiers used for advertising (IDFA /
Android Advertising ID). The app displays no ads and contains no ad SDK.

The one exception to "no location" is the approximate, country- or region-level
location that OneSignal may infer from your IP address, described in section
2.4. That is a by-product of your device connecting to the internet rather than
something the app measures or asks permission for, we do not use it to target or
identify you, and we do not receive any more precise location than that.

> Note: the "camera" in the app's Vanguard reader is a purely software view
> control that pans and zooms the page image. It does not use your device's
> physical camera, and the app never requests camera permission.

### 2.8 Optional print subscriptions

Subscribing is optional and pays for printed issues delivered to your address;
it does not unlock articles or other features in the app. Subscription links
open **Ludus** for online payment or **Google Forms** for check or cash
arrangements in your browser, outside the app.

The Tower receives the information you choose to provide, including your
**name, contact information, and mailing address**, so staff can arrange your
subscription, send your printed issues, and contact you about delivery. These
records are separate from your on-device app account and class schedule. The
app does not automatically attach your app account or schedule to the links.

Online payment details are entered with the external checkout service; the app
does not collect or store your card details. Ludus and Google handle information
submitted through their services under their own privacy policies:
[Ludus](https://hello.ludus.com/privacy) and
[Google](https://policies.google.com/privacy).

Tower staff handling subscriptions use the details you submit to manage print
delivery. Your name and mailing address are used for shipping labels and the
postal or delivery service that sends your issues. Contact
**towerbusiness@gmail.com** to ask about your subscription information or
request access, correction, or deletion. Removing the app or its on-device
account does not cancel a print subscription or delete records held separately
by The Tower or the external providers.

---

## 3. How we use information

We use the information described above only to:

- show you the newspaper and let you save, search, and share articles;
- send notifications you have opted into;
- arrange print deliveries and contact subscribers about their subscriptions;
- keep the app secure, diagnose crashes and bugs, and prevent abuse; and
- comply with the law and with school district policy.

We do not use information for advertising, and we do not sell, rent, or trade
it.

---

## 4. Who we share information with

We share information only with the service providers that make the app work, and
only to the extent needed:

| Provider | What it handles | Its privacy policy |
| --- | --- | --- |
| **Supabase, Inc.** | Article database, images/PDFs | https://supabase.com/privacy |
| **Google LLC** (Forms, Fonts) | Editorial and subscription forms, fonts | https://policies.google.com/privacy |
| **Ludus Technologies Inc.** | External print-subscription checkout | https://hello.ludus.com/privacy |
| **OneSignal, Inc.** | Push notification delivery | https://onesignal.com/privacy_policy |
| **Apple Inc. / Google LLC** (app stores) | App distribution and push transport | Apple / Google policies |

We may also disclose information if we are legally required to do so, or where
Princeton Public Schools policy or law requires disclosure: for example, in
response to a lawful request, or to address a credible threat to someone's
safety.

**Other students:** the app shows other readers nothing about you. There is no
classmates list, no profile, no shared schedule, and no way for one reader to
learn anything at all about another through the app.

Members of *The Tower*'s editorial board and its faculty advisers can read
letters and form responses submitted through the app's Google Forms, as part of
normal newsroom operations.

---

## 5. Data retention

- **App reader accounts:** we do not keep server-side accounts. Print-subscription
  records and voluntary form submissions are separate from the app account.
- **Letters and editorial form submissions** are held in *The Tower*'s Google account as
  part of the newspaper's editorial record. Published material remains
  published.
- **Push notification records** are kept while your device stays subscribed.
  Uninstalling the app or disabling notifications ends the subscription.
- **On-device data** stays until you clear it or uninstall the app.
- **Sign-in codes** are deleted as soon as you enter the code, and in any case
  within 15 minutes, when they expire.
- **Your account** stays on your phone until you sign out, delete it, uninstall
  the app, or the school year ends, whichever comes first.

Records created by version 1.0 of the app (accounts, profiles and class
schedules) were deleted from our database on August 10, 2026.

---

## 6. Your choices and rights

You can, at any time:

- **Read anonymously**: everything except the class schedule works without
  signing in.
- **Sign out**, from the account circle at the top of the screen. Your class
  list stays on the device, so signing back in restores it.
- **Delete your account**, from the same place or from the account screen. This
  removes the sign-in, your class list and your saved articles from the
  device.
- **Turn off notifications**: decline the prompt, or disable notifications for
  PHS Tower in your device settings.
- **Delete on-device data**: uninstall the app.
- **Ask us anything about your information** by emailing
  **phstowersenioreditors@gmail.com**. We will respond within a reasonable
  period, normally within 30 days.

Deleting your account takes effect immediately and needs no request to us,
because the account is on your phone rather than on our servers. For the same
reason we cannot delete it for you, and we cannot restore it afterwards.
If you submitted a letter through the form and want it withdrawn, email us,
though publication in *The Tower* cannot be retracted after the fact. Push
notifications are tied to your device rather than to any identity, so turn them
off in your device settings or uninstall the app. Saved articles and game
progress stay on your device until you uninstall.

Depending on where you live, you may have additional rights under laws such as
the EU/UK GDPR or the California Consumer Privacy Act, including rights of
access, correction, deletion, portability, and the right to object to certain
processing. We do not sell personal information or share it for cross-context
behavioral advertising as those terms are used in California law. To exercise
any right, use the contact address above; we will not discriminate against you
for doing so.

Where the GDPR applies, our legal bases are: **consent** (notifications) and
**legitimate interests** (running and securing the app, publishing the
newspaper), plus **legal obligation** where applicable.

---

## 7. Children's privacy

The app is intended for Princeton High School students, their families, and the
surrounding community, and is rated for users **13 and older**. It is not
directed to children under 13, and we do not knowingly collect personal
information from children under 13. If you believe a child under 13 has provided
us personal information, email **phstowersenioreditors@gmail.com** and we will
delete it promptly.

Because many of our readers are minors, we keep collection to a minimum by
design: no server-side accounts, no ads, no tracking, no advertising
identifiers, and no location data.

---

## 8. Security

Traffic between the app and our servers uses standard HTTPS/TLS encryption. The
app can only **read** from our database; it has no ability to write to it.
Access to submitted letters is limited to Tower editors and advisers.
Subscription details are handled separately by the staff managing print
subscriptions and the external services used for checkout, forms, and delivery.

No system is perfectly secure, and we cannot guarantee absolute security.
Keeping app accounts on-device does not mean subscription records or voluntary
form submissions do not exist.

---

## 9. Where your information is processed

Our service providers (Supabase, Google, OneSignal, and Ludus) operate servers in the
United States and may process and store information there and in other
countries. If you use the app from outside the United States, you understand
that your information will be transferred to and processed in the United States.

---

## 10. Changes to this policy

We may update this policy as the app changes. When we do, we will increment the
version number and revise the "Last updated" date above, and post the new
version in the app and at the policy URL listed on our App Store and Google
Play listings: the URL itself stays the same. Material changes will be
announced in the app. Continuing to use the app after an update means you accept
the revised policy.

---

## 11. Contact us

**The Tower: Princeton High School**\
151 Moore Street, Princeton, NJ 08540\
Email: **phstowersenioreditors@gmail.com**

*The Tower* is a student publication of Princeton High School, Princeton Public
Schools.
