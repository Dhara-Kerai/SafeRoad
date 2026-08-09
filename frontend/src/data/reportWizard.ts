// Options and a blank report-location value for the reporting wizard.
import type { Location, RoadType, Severity, Traffic } from '../types/Report';
export const roadTypes: RoadType[] = ['Highway', 'Main Road', 'Street', 'Village Road', 'Bridge'];
export const severityLevels: Severity[] = ['Low', 'Medium', 'High', 'Critical'];
export const trafficLevels: Traffic[] = ['Low', 'Medium', 'Heavy'];
export const emptyLocation: Location = { latitude: '', longitude: '', roadName: '', area: '', state: '', city: '', landmark: '' };
