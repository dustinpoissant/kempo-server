export default async function(request, response) {
  const { id } = request.params;
  
  // Example user data
  const userData = {
    id: id,
    profile: {
      name: `${id.charAt(0).toUpperCase()}${id.slice(1)}`,
      joinDate: '2024-01-15',
      posts: 42
    }
  };
  
  response.json(userData);
}
