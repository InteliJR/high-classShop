import axios from "axios";

// Instanciar a origem das rquisições para a api
const api = axios.create({
  baseURL: "http://localhost:3000",
});

// Adiciona token de acesso no header das requisições
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("AccessHCS");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;