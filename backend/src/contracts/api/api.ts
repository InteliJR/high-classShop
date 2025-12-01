import axios from "axios"

// Link da api de teste da zapSign
export const zapSignUrl = 'https://sandbox.api.zapsign.com.br/api/v1/' 

export const api = axios.create({baseURL: zapSignUrl});