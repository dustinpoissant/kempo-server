export default async function(request, response) {
  const { id, info } = request.params;
  
  // Example detailed user info
  const userInfo = {
    id: id,
    details: {
      bio: `This is ${id}'s bio`,
      location: 'Earth',
      website: `https://${id}.dev`,
      followers: 123,
      following: 456
    }
  };
  
  response.json(userInfo);
}
