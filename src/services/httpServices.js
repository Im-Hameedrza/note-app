import axios from "axios";

const app = axios.create({
  baseURL: "/api",
});

const http = {
  get: app.get,
  patch: app.patch,
  delete: app.delete,
  put: app.put,
  post: app.post,
};

export default http;
