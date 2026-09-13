# Version Footer Fix

The footer now reads the installed Electron app version from the updater state instead of a hard-coded version.

Example:
`V.I.P LOGISTICS TRANSPORT VTC · TOGETHER WE CAN · Delivery App v0.5.36`

Future releases automatically display their installed version.

The Windows installer `artifactName` is also preserved as:
`V.I.P-LOGISTICS-TRANSPORT-DELIVERY-APP-Setup-${version}.${ext}`
