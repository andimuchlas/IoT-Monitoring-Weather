import health from "./health.route";
import auth from "./auth.route";
import devices from "./devices.route";
import sensorTypes from "./sensor-types.route";
import sensors from "./sensors.route";
import ingest from "./ingest.route";

export const v1Routes = [health, auth, devices, sensorTypes, sensors, ingest];
